import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const source = readFileSync(new URL("../src/lib/telegram-moderation-notice.ts", import.meta.url), "utf8")
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { moderationAuthorizationText, moderationShareUrl } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`)

test("temporary group notice calls for authorization and retains the real remaining steps", () => {
  for (const step of ["contact", "email", "password"]) {
    const text = moderationAuthorizationText("<a href=\"tg://user?id=1\">Иван</a>", step)
    assert.match(text, /авторизаци/)
    assert.doesNotMatch(text, /регистраци/i)
    assert.match(text, /5 минут/)
    assert.match(text, /пароль/)
    assert.equal(text.includes("Подтвердите свой телефон"), step === "contact")
    assert.equal(text.includes("Укажите почту"), step !== "password")
    assert.ok(text.length < 1024)
  }
})

test("share uses the current public chat and falls back to the bot for private chats", () => {
  const publicShare = new URL(moderationShareUrl("@cars_kazan", "lewheelbot"))
  assert.equal(publicShare.origin + publicShare.pathname, "https://t.me/share/url")
  assert.equal(publicShare.searchParams.get("url"), "https://t.me/cars_kazan")
  assert.equal(new URL(moderationShareUrl(undefined, "lewheelbot")).searchParams.get("url"), "https://t.me/lewheelbot")
  assert.equal(new URL(moderationShareUrl("bad/path?x=1", "lewheelbot")).searchParams.get("url"), "https://t.me/lewheelbot")
  assert.equal(moderationShareUrl(undefined, undefined), null)
})

test("webhook wires authorization and sharing without changing temporary cleanup", () => {
  const webhook = readFileSync(new URL("../src/app/api/telegram/webhook/route.ts", import.meta.url), "utf8")
  assert.match(webhook, /text: "🔐 Пройти авторизацию"/)
  assert.match(webhook, /text: "📤 Рассказать другу"/)
  assert.match(webhook, /moderationShareUrl\(chatUsername, getTelegramBotUsername\(\)/)
  assert.match(webhook, /moderationAuthorizationText\(userMention, pendingStep\)/)
  assert.match(webhook, /scheduleTemporarySystemMessage\(chatId, sentMessage\)/)
})

test("only moderation notices upload the configured local cover; missing files preserve legacy fallback", async () => {
  const route = readFileSync(new URL("../src/app/api/telegram/webhook/route.ts", import.meta.url), "utf8")
  const ast = ts.createSourceFile("route.ts", route, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "sendBrandedMessage")
  assert.ok(fn)
  const functionJs = ts.transpileModule(ts.createPrinter().printNode(ts.EmitHint.Unspecified, fn, ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const calls = []
  let file = Buffer.from("dummy-image")
  let ambiguous = false
  const makeSender = new Function("process", "readLocalPhotos", "photoMime", "telegramPhotoApi", "telegramApi", "BRANDED_PHOTO_FILE_ID", "console",
    `${functionJs}; return sendBrandedMessage`)
  const send = makeSender({ env: { TELEGRAM_MODERATION_IMAGE: "/uploads/authorization-20261103.jpg" } },
    async photos => { calls.push(["read", photos]); return new Map(file ? [[photos[0], file]] : []) },
    () => "image/jpeg",
    async (payload, options) => {
      calls.push(["upload", payload, options])
      if (ambiguous) throw new Error("response lost after provider acceptance")
      return { message_id: 10 }
    },
    async (method, payload) => { calls.push([method, payload]); return { message_id: 11 } },
    "dummy-legacy-file-id", { warn: () => {}, error: () => {} })
  const keyboard = { inline_keyboard: [] }
  assert.equal((await send("-123", "Авторизация", keyboard, true)).message_id, 10)
  assert.equal(calls[1][0], "upload")
  assert.equal(calls[1][1].reply_markup, keyboard)
  assert.equal(calls[1][2].uploads[0].data, file)
  calls.length = 0
  await send("123", "Private greeting", keyboard)
  assert.equal(calls[0][0], "sendPhoto")
  assert.equal(calls[0][1].photo, "dummy-legacy-file-id")
  calls.length = 0; file = null
  await send("-123", "Авторизация", keyboard, true)
  assert.equal(calls[1][0], "sendPhoto")
  assert.equal(calls[1][1].photo, "dummy-legacy-file-id")
  calls.length = 0; file = Buffer.from("dummy-image"); ambiguous = true
  assert.equal(await send("-123", "Авторизация", keyboard, true), null)
  assert.deepEqual(calls.map(call => call[0]), ["read", "upload"], "unknown delivery never triggers another photo or text")
})

test("actual mention builder keeps escaped long names within photo caption budget", () => {
  const route = readFileSync(new URL("../src/app/api/telegram/webhook/route.ts", import.meta.url), "utf8")
  const ast = ts.createSourceFile("route.ts", route, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const printer = ts.createPrinter()
  const functions = ["telegramUserMention", "escapeTelegramHtml"].map(name => {
    const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
    assert.ok(node)
    return printer.printNode(ts.EmitHint.Unspecified, node, ast)
  }).join("\n")
  const compiled = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const mention = new Function(`${compiled}; return telegramUserMention`)()({
    id: 1234567890123, first_name: "<&🚗".repeat(128), last_name: "<&".repeat(128), username: "x".repeat(32),
  })
  assert.match(mention, /…<\/a>/)
  assert.doesNotMatch(mention.replace(/<a [^>]+>|<\/a>|&(amp|lt|gt|quot);/g, ""), /[<&]/)
  for (const step of ["contact", "email", "password"]) {
    assert.ok(moderationAuthorizationText(mention, step).length <= 1024)
  }
})
