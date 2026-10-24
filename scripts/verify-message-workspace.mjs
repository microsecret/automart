import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.match(process.env.DATABASE_URL || "", /^file:\/tmp\/automart-auth-audit\.[\w-]+\/automart-audit\.db$/)
assert.ok(process.env.NEXTAUTH_SECRET)
const output = "/tmp/lewheel-message-workspace-20261024"
await mkdir(output, { recursive: true })
const db = new PrismaClient(), checks = []
let browser
function check(name, value) { assert.ok(value, name); checks.push(name); console.log(`PASS ${name}`) }
async function cookie(user) {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 1800, token: { id: user.id, sub: user.id, role: user.role } })
  return `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
}
try {
  const marker = Date.now()
  const owner = await db.user.create({ data: { name: "ВладелецЯщика", email: `mail-${marker}@audit.invalid` } })
  const stranger = await db.user.create({ data: { name: "Чужой пользователь", email: `private-${marker}@audit.invalid` } })
  const peer = await db.user.create({ data: { name: "Чужой собеседник", email: `peer-${marker}@audit.invalid` } })
  const auth = await cookie(owner)
  const category = await db.category.create({ data: { name: `Аудит ${marker}`, icon: "car" } })
  const car = await db.vehicle.create({ data: {
    make: "Toyota", model: "RAV4", year: 2024, price: 3100000, mileage: 18000,
    fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SUV", color: "Белый", power: 199, engineVolume: 2,
    driveType: "AWD", condition: "EXCELLENT", location: "Москва", vehicleType: "CAR", steeringWheel: "LEFT",
    ownersCount: 1, documentsStatus: "CLEAN", damageInfo: "NONE", sellerType: "OWNER", availability: "IN_STOCK",
    customsCleared: true, generation: "V", description: "Изолированная проверка избранного", images: "[]",
    userId: peer.id, categoryId: category.id,
    listings: { create: { title: "РедкийМотор Toyota RAV4", price: 3100000, status: "ACTIVE", userId: peer.id } },
  }, include: { listings: true } })
  const listing = car.listings[0]
  let archiveId
  for (let i = 0; i < 25; i++) {
    const contact = await db.user.create({ data: { name: i === 1 ? "ИванЁлкин" : `Контакт ${i}`, email: `contact-${marker}-${i}@audit.invalid` } })
    const conversationId = `${[owner.id, contact.id].sort().join("-")}-${i === 2 ? listing.id : "no-listing"}`
    if (i === 0) archiveId = conversationId
    const createdAt = new Date(marker - (25 - i) * 60000)
    await db.message.create({ data: { conversationId, senderId: contact.id, receiverId: owner.id, content: i === 0 ? "АрхивЁж *?[x]%" : `Сообщение ${i}`, createdAt, ...(i === 2 ? { listingId: listing.id } : {}) } })
    if (i === 0) await db.message.create({ data: { conversationId, senderId: owner.id, receiverId: contact.id, content: "Последний ответ", createdAt: new Date(createdAt.getTime() + 1000) } })
  }
  const privateId = `${[stranger.id, peer.id].sort().join("-")}-no-listing`
  await db.message.create({ data: { conversationId: privateId, senderId: stranger.id, receiverId: peer.id, content: "АрхивЁж СекретЧужогоЯщика" } })
  const request = async (query = "", page = 1, limit = 20, identity = auth) => {
    const response = await fetch(`${base}/api/messages?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`, { headers: { Cookie: identity } })
    return { status: response.status, body: await response.json() }
  }
  check("anonymous mailbox denied", (await request("", 1, 20, "")).status === 401)
  const first = await request()
  check("default pagination has 25 conversations", first.status === 200 && first.body.pagination.total === 25 && first.body.conversations.length === 20)
  check("archive is outside first page", !first.body.conversations.some((row) => row.id === archiveId))
  const archived = await request("аРхИвёЖ")
  check("Cyrillic search covers historical messages beyond first page", archived.status === 200 && archived.body.pagination.total === 1 && archived.body.conversations[0].id === archiveId)
  check("historical match presents actual latest reply", archived.body.conversations[0].lastMessage.content === "Последний ответ")
  check("counterpart name is case insensitive", (await request("иванёлкин")).body.pagination.total === 1)
  check("listing title is searchable", (await request("редкиймотор")).body.pagination.total === 1)
  check("own name does not match every conversation", (await request("ВладелецЯщика")).body.pagination.total === 0)
  check("foreign messages never leak", (await request("СекретЧужогоЯщика")).body.pagination.total === 0)
  check("literal glob metacharacters match literally", (await request("*?[x]%")).body.pagination.total === 1)
  check("SQL-looking input stays data", (await request("' OR 1=1 --")).body.pagination.total === 0)
  check("oversized query rejected", (await request("я".repeat(121))).status === 400)
  const page2 = await request("Контакт", 2, 7)
  check("search is paginated after matching", page2.body.pagination.total === 24 && page2.body.conversations.length === 7 && page2.body.pagination.pages === 4)
  check("search never marks messages read", await db.message.count({ where: { receiverId: owner.id, isRead: false } }) === 25)
  const unread = await fetch(`${base}/api/messages?unreadCountOnly=true`, { headers: { Cookie: auth } }).then((response) => response.json())
  check("unread badge count unchanged", unread.count === 25)
  await db.user.update({ where: { id: owner.id }, data: { favoriteListings: { connect: { id: car.listings[0].id } } } })

  let executablePath = chromium.executablePath()
  try { await access(executablePath) } catch {
    for (const folder of (await readdir("/root/.cache/ms-playwright")).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
      const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
      try { await access(candidate); executablePath = candidate; break } catch { /* next browser */ }
    }
  }
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  for (const mobile of [false, true]) for (const theme of ["light", "dark"]) {
    const key = `${mobile ? "mobile" : "desktop"}-${theme}`
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce", extraHTTPHeaders: { Cookie: auth } })
    await context.addInitScript((theme) => { localStorage.setItem("automart-color-scheme", theme); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    const page = await context.newPage(), errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${base}/messages`, { waitUntil: "networkidle" })
    const input = page.getByRole("searchbox", { name: "Поиск по диалогам" })
    await input.waitFor()
    await page.locator(`html[data-mantine-color-scheme="${theme}"]`).waitFor()
    check(`${key}: one heading and compact banner`, await page.locator("h1").count() === 1 && await page.locator(".lw-messages-banner").evaluate((node) => node.getBoundingClientRect().height <= 200))
    check(`${key}: original messages artwork loads`, await page.locator('.lw-messages-banner img').evaluate((node) => node.complete && node.naturalWidth > 0 && node.src.includes("messages-")))
    check(`${key}: banner action uses solid fill`, await page.locator('.lw-messages-banner .mantine-Button-root').getAttribute("data-variant") === "filled")
    await input.fill("архивёж")
    await page.getByText("Последний ответ", { exact: true }).waitFor()
    check(`${key}: search keeps keyboard focus`, await input.evaluate((node) => node === document.activeElement))
    check(`${key}: material avatars present`, await page.locator(".messages-workspace .lw-user-avatar").count() > 0)
    check(`${key}: unread counter has readable text`, await page.locator(".messages-unread-count").first().evaluate((node) => node.textContent.trim() === "1" && node.getBoundingClientRect().width >= 22 && getComputedStyle(node.querySelector(".mantine-Badge-label")).color === "rgb(255, 255, 255)"))
    check(`${key}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await input.fill("НеСуществуетНичего")
    await page.getByText("Ничего не найдено", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Сбросить поиск", exact: true }).click()
    await page.getByRole("button", { name: "Очистить поиск", exact: true }).waitFor({ state: "hidden" })
    check(`${key}: reset clears input and restores focus`, await input.inputValue() === "" && await input.evaluate((node) => node === document.activeElement))
    await input.fill("архивёж")
    await page.getByText("Последний ответ", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Очистить поиск", exact: true }).click()
    check(`${key}: clear action works`, await input.inputValue() === "")
    await page.locator(".messages-conversation-row").filter({ hasText: "Контакт 24" }).waitFor()
    if (!mobile) await page.getByText("Выберите диалог", { exact: true }).waitFor()
    check(`${key}: full mailbox stays compact with internal scroll`, await page.locator(".messages-workspace").evaluate((node) => node.getBoundingClientRect().height <= 650) && await page.locator(".messages-workspace__list").evaluate((node) => node.scrollHeight > node.clientHeight))
    await page.locator(".messages-conversation-row").last().focus()
    check(`${key}: keyboard focus scrolls to lower conversations`, await page.locator(".messages-workspace__list").evaluate((node) => node.scrollTop > 0))
    await page.locator(".messages-conversation-row").first().focus()
    await page.locator(".messages-workspace__list").evaluate((node) => { node.scrollTop = 0 })
    await page.screenshot({ path: `${output}/messages-${key}.png`, fullPage: true })
    await page.goto(`${base}/favorites`, { waitUntil: "networkidle" })
    await page.locator(".lw-favorites-banner").waitFor()
    check(`${key}: favorites has distinct compact identity`, await page.locator(".lw-favorites-banner img").evaluate((node) => node.complete && node.naturalWidth > 0) && await page.locator(".lw-favorites-banner").evaluate((node) => node.getBoundingClientRect().height <= 200))
    check(`${key}: favorites fits viewport`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const listRadio = page.getByRole("radio", { name: "Список", exact: true })
    const gridRadio = page.getByRole("radio", { name: "Сетка", exact: true })
    await page.locator(`label[for="${await listRadio.getAttribute("id")}"]`).click()
    check(`${key}: accessible list view works`, await listRadio.isChecked())
    await page.locator(`label[for="${await gridRadio.getAttribute("id")}"]`).click()
    check(`${key}: accessible grid view works`, await gridRadio.isChecked())
    check(`${key}: no runtime errors`, errors.length === 0)
    await page.screenshot({ path: `${output}/favorites-${key}.png`, fullPage: true })
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks, failures: [] }, null, 2))
  console.log(`MESSAGE_WORKSPACE_VERIFIED checks=${checks.length}`)
} finally { await browser?.close(); await db.$disconnect() }
