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
  /* Подача в мини-приложении переехала на главную кнопку Telegram: она
     стоит в том же нижнем краю экрана, что и панель вкладок, и две
     одинаковые цели друг на друге только мешали. Вкладки «create» в
     панели больше нет. */
  assert.equal(TELEGRAM_TAB_NAVIGATION.some((item) => item.href.includes(CREATE_VEHICLE_HREF)), false)
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

test("мобильная панель отвечает срочным задачам, а не дублирует кабинет", () => {
  /* Форум занял место новостей: новости живут в шапке и читаются
     разом, а форум без входа с телефона не заживёт — именно туда
     возвращаются за ответом на свой вопрос.

     Заправки заняли место аукционов: на телефоне помещается пять
     пунктов, и место в них дороже всего. Аукционы смотрят вдумчиво, за
     столом, выбирая машину неделями; на заправку человек ищет ответ за
     рулём и прямо сейчас. Аукционы остались в шапке и боковом меню. */
  assert.deepEqual(SITE_MOBILE_NAVIGATION.map((item) => item.id), ["home", "fuel-map", "create", "forum", "messages"])
})

/* Секции меню описаны разными кортежами (в разделе стран свои значения
   id), и flatMap по ним не сводится к одному типу. Для проверок нужны
   только id и адрес, поэтому список приводится к простой форме явно. */
const telegramMenuItems: { id: string; href: string }[] =
  TELEGRAM_MENU_NAVIGATION.flatMap((section) =>
    (section.items as readonly { id: string; href: string }[]).map((item) => ({
      id: item.id,
      href: item.href,
    })),
  )

const telegramTabItems: { id: string; href: string }[] =
  (TELEGRAM_TAB_NAVIGATION as readonly { id: string; href: string }[]).map((item) => ({
    id: item.id,
    href: item.href,
  }))

test("форум доступен в приложении Telegram", () => {
  /* Форум ушёл из нижней панели в выезжающее меню: панель теперь ведёт
     только внутрь мини-приложения, а форум открывает обычный сайт, где
     нет ни панели, ни возврата. Пропасть он при этом не должен. */
  assert.ok(telegramMenuItems.some((item) => item.id === "forum"), "форума нет в выезжающем меню приложения")
})

test("ссылки на сайт из приложения помечены источником", () => {
  // Без пометки переход из приложения считается заходом с сайта, и
  // страница открывается в обычной вёрстке, а не в приложении.
  const links = [...telegramTabItems, ...telegramMenuItems]
    .filter((item) => item.href.startsWith("/forum") || item.href.startsWith("/services/fuel-map"))

  assert.ok(links.length >= 2, "ожидались ссылки на форум и карту")
  for (const link of links) assert.match(link.href, /from=telegram/)
})

// === Вкладки приложения ===

test("в нижнем меню приложения пять вкладок", () => {
  // Больше на телефоне не помещается: подписи начинают обрезаться.
  assert.equal(TELEGRAM_TAB_NAVIGATION.length, 5)
})

test("карта АЗС есть в нижнем меню приложения", () => {
  /* В дефицит топлива человек открывает её по нескольку раз в день —
     чаще, чем заходит в кабинет. */
  assert.ok(TELEGRAM_TAB_NAVIGATION.some((item) => item.href.includes("/services/fuel-map")))
})

test("кабинет убран из нижнего меню, но остался в выезжающем", () => {
  /* Кабинет открывают раз в неделю — в панели из пяти мест ему не место,
     но пропасть из приложения он не должен. */
  assert.equal(TELEGRAM_TAB_NAVIGATION.some((item) => item.href.includes("/dashboard")), false)

  const menuHrefs = TELEGRAM_MENU_NAVIGATION.flatMap((section) => section.items.map((item) => item.href))
  assert.ok(menuHrefs.some((href) => href.includes("/dashboard")))
})

test("панель приложения ведёт внутрь него, а не на сайт", () => {
  /* Прежний состав уводил наружу и оставлял там: «Продать» и «Форум»
     открывали обычный сайт с десктопной шапкой и подвалом во вьюпорте
     телефона, а вернуться в ленту было нечем — панели там уже нет.

     Аукционы и сообщения при этом были написаны и работали внутри
     приложения, но попасть в них можно было только через выезжающее
     меню: человек не знал, что они есть. Поэтому решение о переносе
     аукционов в меню пересмотрено — они вернулись в панель. */
  const insideApp = TELEGRAM_TAB_NAVIGATION.filter((item) => item.href.startsWith("/telegram"))
  assert.ok(insideApp.length >= 4, "почти все вкладки должны вести внутрь приложения")
  assert.ok(TELEGRAM_TAB_NAVIGATION.some((item) => item.href.includes("tab=auctions")))
  assert.ok(TELEGRAM_TAB_NAVIGATION.some((item) => item.href.includes("tab=chats")))
})

test("сервисы сайта доступны из приложения", () => {
  /* Человек, зашедший через приложение, не знал ни про карту АЗС, ни про
     проверку истории — а это ровно то, за чем он вернулся бы. */
  const menuHrefs = TELEGRAM_MENU_NAVIGATION.flatMap((section) => section.items.map((item) => item.href))
  for (const service of SERVICE_NAVIGATION) {
    assert.ok(
      menuHrefs.some((href) => href.startsWith(service.href)),
      `сервис ${service.label} потерян в приложении`,
    )
  }
})

test("ссылки приложения помечены источником", () => {
  /* По признаку from=telegram страницы понимают, что человек пришёл из
     бота, и не встречают его формой пароля. */
  for (const item of TELEGRAM_TAB_NAVIGATION) {
    if (item.href.startsWith("/telegram")) continue
    assert.match(item.href, /from=telegram|source=telegram/, `${item.label} без признака источника`)
  }
})
