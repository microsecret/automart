import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

/* Серверные данные подставляются в SWR по совпадению ключа, и совпадение
   посимвольное: разойдись строка с той, что собирает buildQuery — витрина
   молча вернётся к пустой разметке, без единой ошибки в журнале. Именно
   поэтому обе стороны сверяются здесь, а не держатся на договорённости.

   Модуль читается как текст, а не импортируется: он тянет Prisma через
   псевдоним "@/", которого запускатель тестов не разбирает. */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
const client = read("../src/components/catalog/HomeCatalog.tsx")
const server = read("../src/lib/catalog-first-page.ts")

const serverKey = server.match(/CATALOG_FIRST_PAGE_KEY =\s*\n?\s*"([^"]+)"/)?.[1]
const serverLimit = server.match(/CATALOG_FIRST_PAGE_LIMIT = (\d+)/)?.[1]

test("ключ первой страницы вообще объявлен", () => {
  assert.ok(serverKey, "в модуле не нашёлся CATALOG_FIRST_PAGE_KEY")
  assert.ok(serverLimit, "в модуле не нашёлся CATALOG_FIRST_PAGE_LIMIT")
})

test("клиент просит столько же объявлений, сколько готовит сервер", () => {
  const limit = client.match(/q\.set\("limit", "(\d+)"\)/)
  assert.ok(limit, "в buildQuery не нашёлся limit")
  assert.equal(limit[1], serverLimit)
  assert.match(serverKey!, new RegExp(`limit=${serverLimit}`))
})

test("сортировка по умолчанию совпадает с серверной выборкой", () => {
  // Сервер читает по createdAt desc — это и есть «newest» у клиента.
  assert.match(client, /useState\("newest"\)/)
  assert.match(serverKey!, /sort=newest/)
  assert.match(server, /orderBy: \[\{ createdAt: "desc" \}/)
})

test("витрина по умолчанию показывает технику, а не запчасти", () => {
  const fallback = client.match(/q\.set\("type", p\.initialType \|\| "(\w+)"\)/)
  assert.ok(fallback, "в buildQuery не нашёлся тип по умолчанию")
  assert.match(serverKey!, new RegExp(`type=${fallback[1]}`))
})

test("ключ собран в том же порядке параметров, что и строка клиента", () => {
  // buildQuery выставляет их именно так: type, page, limit, sort.
  assert.equal(serverKey, "/api/listings?type=vehicle&page=1&limit=20&sort=newest")
})

test("стартовые данные подставляются только для витрины без фильтров", () => {
  // Без сверки ключа отфильтрованный список на миг показал бы чужие
  // карточки — те, что сервер отдал для витрины целиком.
  assert.match(client, /listingsKey === CATALOG_FIRST_PAGE_KEY/)
})

test("сбой базы не роняет главную", () => {
  // Витрина остаётся рабочей и без стартового наполнения: карточки
  // дорисует браузер, как было до этой правки.
  assert.match(server, /catch \(error\) \{[\s\S]*?return null/)
})
