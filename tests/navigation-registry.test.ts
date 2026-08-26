import assert from "node:assert/strict"
import test from "node:test"

import {
  CREATE_VEHICLE_HREF,
  DASHBOARD_NAVIGATION,
  FOOTER_NAVIGATION,
  isNavigationItemActive,
  PLATFORM_NAVIGATION,
  PRIMARY_NAVIGATION,
  SERVICE_NAVIGATION,
  SITE_MOBILE_NAVIGATION,
  TELEGRAM_MENU_NAVIGATION,
  TELEGRAM_TAB_NAVIGATION,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/navigation-registry.ts"

function assertUnique(values: readonly string[], label: string) {
  assert.equal(new Set(values).size, values.length, `${label}: найдены дубли`)
}

test("основные разделы не повторяются в меню платформы", () => {
  assertUnique(PRIMARY_NAVIGATION.map((item) => item.id), "primary ids")
  assertUnique(PRIMARY_NAVIGATION.map((item) => item.href), "primary hrefs")
  assertUnique(PLATFORM_NAVIGATION.map((item) => item.href), "platform hrefs")

  const primaryHrefs = new Set<string>(PRIMARY_NAVIGATION.map((item) => item.href))
  assert.equal(PLATFORM_NAVIGATION.some((item) => primaryHrefs.has(item.href)), false)
})

test("все действия подачи объявления ведут на полную форму", () => {
  const telegramHrefs = [
    ...TELEGRAM_TAB_NAVIGATION.map((item) => item.href),
    ...TELEGRAM_MENU_NAVIGATION.flatMap((section) => section.items.map((item) => item.href)),
    ...SITE_MOBILE_NAVIGATION.map((item) => item.href),
  ]

  assert.equal(telegramHrefs.some((href) => href.includes("/listings/create/quick")), false)
  assert.equal(TELEGRAM_TAB_NAVIGATION.find((item) => item.id === "create")?.href, `${CREATE_VEHICLE_HREF}?source=telegram`)
  assert.equal(SITE_MOBILE_NAVIGATION.find((item) => item.id === "create")?.href, CREATE_VEHICLE_HREF)
})

test("личный кабинет использует канонические маршруты без дублирующей вкладки избранного", () => {
  assertUnique(DASHBOARD_NAVIGATION.map((item) => item.id), "dashboard ids")
  assertUnique(DASHBOARD_NAVIGATION.map((item) => item.href), "dashboard hrefs")
  assert.equal(DASHBOARD_NAVIGATION.find((item) => item.id === "favorites")?.href, "/favorites")
  assert.equal(DASHBOARD_NAVIGATION.find((item) => item.id === "garage")?.label, "Личный гараж")
  assert.equal(DASHBOARD_NAVIGATION.find((item) => item.id === "documents")?.label, "Мои документы")
})

test("подвал получает сервисы из того же реестра", () => {
  const services = FOOTER_NAVIGATION.find((section) => section.title === "Сервисы")
  assert.deepEqual(services?.items, SERVICE_NAVIGATION)
})

test("активный раздел учитывает вложенные маршруты и дополнительные префиксы", () => {
  const listings = PRIMARY_NAVIGATION.find((item) => item.id === "listings")
  const auctions = PRIMARY_NAVIGATION.find((item) => item.id === "auctions")
  assert.ok(listings)
  assert.ok(auctions)

  assert.equal(isNavigationItemActive("/", listings), true)
  assert.equal(isNavigationItemActive("/category/cars", listings), true)
  assert.equal(isNavigationItemActive("/search", listings), true)
  assert.equal(isNavigationItemActive("/auctions/lot-1", auctions), true)
  assert.equal(isNavigationItemActive("/news", auctions), false)
})

test("мобильная панель ведёт на форум, а не дублирует кабинет", () => {
  // Форум занял место новостей: новости живут в шапке и читаются разом, а
  // форум без входа с телефона не заживёт — именно туда возвращаются за
  // ответом на свой вопрос.
  assert.deepEqual(SITE_MOBILE_NAVIGATION.map((item) => item.id), ["home", "auctions", "create", "forum", "messages"])
})
