#!/usr/bin/env node
// Server only. Preview is the default. Live sends require an explicit wave and
// external flock; checkpoint files and cron backups contain private IDs/secrets.
import crypto from "node:crypto"
import https from "node:https"
import path from "node:path"
import { readFile, writeFile, rename, mkdir, chmod, open, unlink } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"
import { PrismaClient } from "@prisma/client"
import ts from "typescript"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const MIN_SPACING_MS = 200
const PHASES = ["registration", "seller"]
const CRON_TAGS = ["automart-registration-reminders", "automart-signup-nudge", "automart-weekly-digest"]
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`

export function parseCampaignArguments(argv) {
  const apply = argv.includes("--apply")
  const index = argv.indexOf("--wave")
  const wave = index >= 0 ? argv[index + 1] : "preview"
  const allowed = new Set(["--apply", "--preview", "--wave", wave])
  if (argv.some((arg) => !allowed.has(arg)) || (apply && argv.includes("--preview"))) throw new Error("Invalid campaign arguments")
  if (!wave || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(wave) || (apply && index < 0)) throw new Error("Apply requires --wave with a safe stable identifier")
  return { apply, wave }
}

export function pauseLifecycleCron(text, wave) {
  const prefix = `# lewheel-campaign-wave:${wave}: `
  let changed = 0
  const cron = text.split("\n").map((line) => {
    if (line.trimStart().startsWith("#")) return line
    if (!CRON_TAGS.some((tag) => line.endsWith(`# ${tag}`))) return line
    changed++
    return prefix + line
  }).join("\n")
  return { cron, changed }
}

export function restoreLifecycleCron(text, wave) {
  const prefix = `# lewheel-campaign-wave:${wave}: `
  let changed = 0
  const cron = text.split("\n").map((line) => {
    if (!line.startsWith(prefix)) return line
    changed++
    return line.slice(prefix.length)
  }).join("\n")
  return { cron, changed }
}

export function shouldSkipCheckpoint(entry) {
  // ATTEMPTED is deliberately terminal for this wave: a lost response can mean
  // Telegram accepted the photo. Only definite rejections are retryable.
  return Boolean(entry && entry.status !== "RETRYABLE")
}

async function writePrivateJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`
  const handle = await open(temporary, "w", 0o600)
  try { await handle.writeFile(JSON.stringify(value)); await handle.sync() } finally { await handle.close() }
  await rename(temporary, file)
  await chmod(file, 0o600)
  const directory = await open(path.dirname(file), "r")
  try { await directory.sync() } finally { await directory.close() }
}

function readCron() {
  try { return execFileSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }
  catch (error) { if (error.status === 1 && /no crontab/i.test(String(error.stderr))) return ""; throw new Error("Could not read scheduler") }
}

function installCron(text) {
  execFileSync("crontab", ["-"], { input: text.endsWith("\n") ? text : text + "\n", stdio: ["pipe", "pipe", "pipe"] })
}

async function waitForExistingWorkers(stopped) {
  const started = Date.now()
  while (!stopped()) {
    const busy = CRON_TAGS.some((tag) => {
      const file = tag === "automart-registration-reminders" ? "/tmp/automart-registration-reminders.lock"
        : tag === "automart-signup-nudge" ? "/tmp/automart-signup-nudge.lock" : "/tmp/automart-weekly-digest.lock"
      try { execFileSync("flock", ["-n", file, "true"], { stdio: "ignore" }); return false } catch { return true }
    })
    if (!busy) return
    if (Date.now() - started > 90000) throw new Error("Existing lifecycle worker is still running; retry the wave later")
    await sleep(1000)
  }
}

/** getMe has no form fields; use a real GET rather than an empty multipart form. */
async function readBotIdentity() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = () => {
      if (settled) return
      settled = true
      reject(new Error("Telegram identity probe failed"))
    }
    const request = https.request({
      hostname: "api.telegram.org", family: 4, port: 443,
      path: `/bot${token}/getMe`, method: "GET", timeout: 15000,
    }, (response) => {
      let body = ""
      response.setEncoding("utf8")
      response.on("error", fail)
      response.on("data", (chunk) => {
        body += chunk
        if (body.length > 100000) { fail(); request.destroy() }
      })
      response.on("end", () => {
        if (settled) return
        try {
          const parsed = JSON.parse(body)
          if (response.statusCode !== 200 || !parsed.ok || !parsed.result) { fail(); return }
          settled = true
          resolve(parsed.result)
        } catch { fail() }
      })
    })
    request.on("error", fail)
    request.on("timeout", () => { fail(); request.destroy() })
    request.end()
  })
}

/** Reuse the exact current TypeScript implementations, not copies of copy/API logic. */
async function campaignRuntime(prisma) {
  const source = await readFile(path.join(ROOT, "src/lib/telegram.ts"), "utf8")
  const ast = ts.createSourceFile("telegram.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const names = ["telegramPhotoApi", "isInternalTelegramEmail", "isPasswordHash", "getTelegramRegistrationStep", "isTelegramUserRegistered", "getTelegramMiniAppUrl", "getTelegramBotUsername", "getTelegramPageUrl"]
  const selected = names.map((name) => {
    const node = ast.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === name)
    if (!node) throw new Error("Required Telegram implementation is missing")
    return node.getFullText(ast)
  }).join("\n")
  const contextKey = `lewheelCampaign${crypto.randomBytes(12).toString("hex")}`
  globalThis[contextKey] = { prisma, crypto, https, readFile, path }
  const shims = moduleUrl(`export const {prisma,crypto,https,readFile,path}=globalThis[${JSON.stringify(contextKey)}]`)
  const cache = new Map([["src/lib/prisma.ts", shims]])
  async function load(relative) {
    if (cache.has(relative)) return cache.get(relative)
    let input = await readFile(path.join(ROOT, relative), "utf8")
    if (relative === "src/lib/telegram.ts") {
      input = `import {crypto,https,readFile,path} from ${JSON.stringify(shims)};\nimport {buildTelegramPageUrl} from "@/lib/telegram-page-url";\n${selected}`
    }
    const imports = [...input.matchAll(/from\s+(["'])(@\/lib\/[^"']+)\1/g)]
    for (const match of imports) {
      const dependency = "src/" + match[2].slice(2) + ".ts"
      const url = await load(dependency)
      input = input.replaceAll(match[1] + match[2] + match[1], JSON.stringify(url))
    }
    const compiled = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    const url = moduleUrl(compiled)
    cache.set(relative, url)
    return url
  }
  const telegram = await import(await load("src/lib/telegram.ts"))
  const schedule = await import(await load("src/lib/signup-nudge-schedule.ts"))
  const content = await import(await load("src/lib/telegram-weekly-digest-content.ts"))
  const lifecycleSource = await readFile(path.join(ROOT, "src/lib/telegram-lifecycle-campaign.ts"), "utf8")
  const lifecycleAst = ts.createSourceFile("lifecycle.ts", lifecycleSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const keyboardNode = lifecycleAst.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === "registrationKeyboard")
  if (!keyboardNode) throw new Error("Registration keyboard implementation is missing")
  const keyboardSource = `import {getTelegramBotUsername,getTelegramMiniAppUrl} from ${JSON.stringify(await load("src/lib/telegram.ts"))};\nimport {WEEKLY_DIGEST_OFF_CALLBACK} from ${JSON.stringify(await load("src/lib/telegram-weekly-digest-message.ts"))};\n${keyboardNode.getFullText(lifecycleAst)}\nexport {registrationKeyboard};`
  const keyboard = await import(moduleUrl(ts.transpileModule(keyboardSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText))
  return { ...telegram, ...schedule, ...content, ...keyboard, dispose: () => { delete globalThis[contextKey] } }
}

export async function runBrandedCampaign(argv = process.argv.slice(2)) {
  const { apply, wave } = parseCampaignArguments(argv)
  if (path.resolve(process.cwd()) !== ROOT) throw new Error("Run from the application root")
  if (apply && process.env.CAMPAIGN_LOCK_HELD !== "1") throw new Error("External campaign flock is required")
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_MINI_APP_URL) throw new Error("Telegram deployment settings are missing")
  process.umask(0o077)
  const prisma = new PrismaClient()
  let runtime
  let paused = false
  let markerOwned = false
  let stopping = false
  let signalCode = 0
  const stop = (signal) => { stopping = true; signalCode = signal === "SIGINT" ? 130 : 143 }
  const onInterrupt = () => stop("SIGINT")
  const onTerminate = () => stop("SIGTERM")
  const directory = path.join(ROOT, ".tmp")
  const checkpointFile = path.join(directory, `campaign-${wave}.json`)
  const activeMarker = path.join(directory, "telegram-campaign-active.json")
  const counts = { sent: 0, registration: 0, seller: 0, blocked: 0, skipped: 0, uncertain: 0, rateLimited: 0, stateUpdatesFailed: 0 }
  try {
    runtime = await campaignRuntime(prisma)
    if (!runtime.getTelegramBotUsername() || !runtime.getTelegramMiniAppUrl()) throw new Error("Valid bot and HTTPS Mini App settings are required")
    // Read-only identity probe prevents a wrong/expired token from consuming
    // a whole audience's attempts or marking another bot's contacts blocked.
    const bot = await readBotIdentity()
    if (!bot?.is_bot || String(bot.username || "").toLowerCase() !== runtime.getTelegramBotUsername().toLowerCase()) {
      throw new Error("Telegram bot identity does not match deployment settings")
    }
    const pictures = {}
    for (const kind of PHASES) pictures[kind] = await readFile(path.join(ROOT, "public/images/telegram/campaign-v1", `${kind}.jpg`))
    const contacts = await prisma.telegramContact.findMany({ where: { blocked: false, weeklyOptOut: false }, select: { telegramId: true }, orderBy: { startedAt: "asc" } })
    const users = await prisma.user.findMany({ where: { telegramId: { in: contacts.map((contact) => contact.telegramId) } }, select: {
      telegramId: true, accountStatus: true, email: true, emailVerified: true, phone: true, telegramVerifiedAt: true, hashedPassword: true,
    } })
    const byId = new Map(users.map((user) => [user.telegramId, user]))
    const audience = { total: 0, registration: 0, seller: 0, restricted: 0 }
    for (const contact of contacts) {
      const user = byId.get(contact.telegramId)
      if (user && user.accountStatus !== "ACTIVE") { audience.restricted++; continue }
      audience.total++
      audience[runtime.isTelegramUserRegistered(user || null) ? "seller" : "registration"]++
    }
    const activeCron = restoreLifecycleCron(readCron(), wave).cron
    const expectedJobs = pauseLifecycleCron(activeCron, wave).changed
    if (!activeCron.split("\n").some((line) => !line.trimStart().startsWith("#") && line.endsWith("# automart-weekly-digest"))) {
      throw new Error("Weekly lifecycle scheduler is missing; wave not started")
    }
    console.log(JSON.stringify({ mode: apply ? "apply" : "preview", audience, maximumPerSecond: 5, phases: PHASES, schedulerJobs: expectedJobs }))
    if (!apply) return { mode: "preview", audience }
    await mkdir(directory, { recursive: true, mode: 0o700 })
    let checkpoint
    try {
      checkpoint = JSON.parse(await readFile(checkpointFile, "utf8"))
      if (checkpoint.version !== 1 || checkpoint.wave !== wave || !Array.isArray(checkpoint.contacts) || !checkpoint.deliveries) throw new Error("Invalid checkpoint")
      if (checkpoint.botId && String(checkpoint.botId) !== String(bot.id)) throw new Error("Checkpoint belongs to another Telegram bot")
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error("Cannot safely load wave checkpoint")
      checkpoint = { version: 1, wave, botId: String(bot.id), createdAt: new Date().toISOString(), contacts: contacts.map((contact) => contact.telegramId), deliveries: {}, photos: {}, status: "RUNNING" }
    }
    checkpoint.photos ||= {}
    await writePrivateJson(checkpointFile, checkpoint)
    process.on("SIGINT", onInterrupt)
    process.on("SIGTERM", onTerminate)
    // The HTTP workers check this before selecting/sending. It intentionally
    // has no expiry: a crashed wave stays fail-closed until the same wave is
    // resumed or an administrator explicitly resolves its marker.
    try {
      const active = JSON.parse(await readFile(activeMarker, "utf8"))
      if (active.wave !== wave) throw new Error("Another campaign wave is active")
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error("Campaign active marker requires explicit recovery")
    }
    await writePrivateJson(activeMarker, { wave, startedAt: new Date().toISOString() })
    markerOwned = true
    // Repair tagged lines left by an ungraceful earlier run before pausing
    // again. Only this wave's own tags are ever changed; other cron jobs stay.
    const currentCron = readCron()
    const resumedCron = restoreLifecycleCron(currentCron, wave).cron
    await writeFile(path.join(directory, `campaign-${wave}.cron-before`), currentCron, { mode: 0o600, flag: "wx" }).catch((error) => { if (error.code !== "EEXIST") throw error })
    const pause = pauseLifecycleCron(resumedCron, wave)
    if (pause.changed !== expectedJobs || resumedCron !== activeCron) throw new Error("Cron changed during preflight; wave not started")
    installCron(pause.cron)
    paused = true
    console.log(JSON.stringify({ schedulerJobsPaused: pause.changed }))
    await waitForExistingWorkers(() => stopping)
    // A pre-marker HTTP worker can have one in-flight multipart send (at most
    // 60 seconds). Drain it before this wave starts its global send spacing.
    const drainUntil = Date.now() + 65000
    while (!stopping && Date.now() < drainUntil) await sleep(Math.min(1000, drainUntil - Date.now()))
    let lastStart = 0
    let processed = 0
    const mark = async (id, entry) => { checkpoint.deliveries[id] = entry; await writePrivateJson(checkpointFile, checkpoint) }
    for (const phase of PHASES) {
      if (stopping) break
      console.log(JSON.stringify({ phase, state: "started" }))
      for (const telegramId of checkpoint.contacts) {
        if (stopping) break
        if (shouldSkipCheckpoint(checkpoint.deliveries[telegramId])) continue
        const contact = await prisma.telegramContact.findUnique({ where: { telegramId }, select: { telegramId: true, firstName: true, startedAt: true, blocked: true, weeklyOptOut: true } })
        const user = await prisma.user.findUnique({ where: { telegramId }, select: {
          accountStatus: true, email: true, emailVerified: true, phone: true, telegramVerifiedAt: true, hashedPassword: true,
        } })
        if (!contact || contact.blocked || contact.weeklyOptOut || (user && user.accountStatus !== "ACTIVE")) {
          await mark(telegramId, { status: "SKIPPED", at: new Date().toISOString() }); counts.skipped++; continue
        }
        const kind = runtime.isTelegramUserRegistered(user) ? "seller" : "registration"
        if (kind !== phase) continue
        const message = kind === "seller" ? await runtime.buildWeeklyDigestFor(telegramId) : {
          text: runtime.nudgeText(Math.max(0, runtime.nudgeIndex(contact.startedAt, new Date())), contact.firstName),
          reply_markup: runtime.registrationKeyboard(),
        }
        let retries = 0
        while (!stopping) {
          // A retry-after wait can outlive registration or moderation changes.
          const liveUser = await prisma.user.findUnique({ where: { telegramId }, select: {
            accountStatus: true, email: true, emailVerified: true, phone: true, telegramVerifiedAt: true, hashedPassword: true,
          } })
          if (liveUser && liveUser.accountStatus !== "ACTIVE") {
            await mark(telegramId, { status: "SKIPPED", at: new Date().toISOString() }); counts.skipped++; break
          }
          if ((runtime.isTelegramUserRegistered(liveUser) ? "seller" : "registration") !== kind) break
          const delay = MIN_SPACING_MS - (Date.now() - lastStart)
          if (delay > 0) await sleep(delay)
          if (stopping) break
          const attemptedAt = new Date()
          await mark(telegramId, { status: "ATTEMPTED", kind, attemptedAt: attemptedAt.toISOString() })
          const allowed = await prisma.telegramContact.updateMany({ where: { telegramId, blocked: false, weeklyOptOut: false }, data: { lastBroadcastAt: attemptedAt } })
          if (allowed.count !== 1) { await mark(telegramId, { status: "SKIPPED", at: new Date().toISOString() }); counts.skipped++; break }
          lastStart = Date.now()
          const fileId = checkpoint.photos[kind]
          try {
            const result = await runtime.telegramPhotoApi({ chat_id: telegramId, caption: message.text, parse_mode: "HTML", reply_markup: message.reply_markup,
              ...(fileId ? { photo: fileId } : {}),
            }, { uploads: fileId ? [] : [{ field: "photo", filename: `lewheel-${kind}.jpg`, contentType: "image/jpeg", data: pictures[kind] }] })
            const uploaded = result?.photo?.at(-1)?.file_id
            if (uploaded) checkpoint.photos[kind] = uploaded
            await mark(telegramId, { status: "SENT", kind, attemptedAt: attemptedAt.toISOString(), sentAt: new Date().toISOString() })
            counts.sent++; counts[kind]++
            await prisma.telegramContact.updateMany({ where: { telegramId }, data: { lastWeeklyAt: attemptedAt, registered: kind === "seller" } })
              .catch(() => { counts.stateUpdatesFailed++ })
            break
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            const retryAfter = /retry after (\d+)/i.exec(reason)
            if (retryAfter) {
              counts.rateLimited++
              await mark(telegramId, { status: "RETRYABLE", kind, at: new Date().toISOString(), retryAfterSeconds: Number(retryAfter[1]) })
              // Telegram explicitly rejected this send. Waiting is safe; an
              // ambiguous network failure takes the terminal branch below.
              if (++retries > 5) { stopping = true; break }
              const until = Date.now() + (Number(retryAfter[1]) + 1) * 1000
              while (!stopping && Date.now() < until) await sleep(Math.min(1000, until - Date.now()))
              continue
            }
            if (fileId && /wrong file identifier|invalid file[_ ]?id|file[_ ]?id.*invalid/i.test(reason) && retries++ === 0) {
              delete checkpoint.photos[kind]
              await mark(telegramId, { status: "RETRYABLE", kind, at: new Date().toISOString() })
              continue
            }
            if (/blocked by the user|user is deactivated|chat not found/i.test(reason)) {
              await mark(telegramId, { status: "BLOCKED", kind, at: new Date().toISOString() })
              await prisma.telegramContact.updateMany({ where: { telegramId }, data: { blocked: true } })
              counts.blocked++
            } else {
              // Keep ATTEMPTED. Never log raw provider/network errors: they
              // can contain chat identifiers or request credentials.
              counts.uncertain++
              stopping = true
            }
            break
          }
        }
        if (++processed % 25 === 0) console.log(JSON.stringify({ progress: counts }))
      }
    }
    checkpoint.status = stopping ? "INTERRUPTED" : "COMPLETE"
    checkpoint.finishedAt = new Date().toISOString()
    checkpoint.lastRun = counts
    await writePrivateJson(checkpointFile, checkpoint)
    console.log(JSON.stringify({ state: checkpoint.status, totals: counts, checkpointEntries: Object.keys(checkpoint.deliveries).length }))
    if (signalCode) process.exitCode = signalCode
    return { state: checkpoint.status, counts }
  } finally {
    if (paused) {
      const restore = restoreLifecycleCron(readCron(), wave)
      installCron(restore.cron)
      console.log(JSON.stringify({ schedulerJobsRestored: restore.changed }))
    }
    // Restore must succeed first. If it throws, keep the marker and fail
    // closed so periodic HTTP workers cannot overlap an unresolved wave.
    if (markerOwned) {
      const active = JSON.parse(await readFile(activeMarker, "utf8"))
      if (active.wave === wave) await unlink(activeMarker)
    }
    process.off("SIGINT", onInterrupt)
    process.off("SIGTERM", onTerminate)
    runtime?.dispose()
    await prisma.$disconnect()
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runBrandedCampaign().catch(() => { console.error("Campaign stopped safely; inspect private checkpoint and scheduler state before resuming."); process.exitCode = 1 })
}
