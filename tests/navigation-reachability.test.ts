import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { FOOTER_NAVIGATION, TELEGRAM_MENU_NAVIGATION } from "../src/lib/navigation-registry.ts"

function allHrefs(sections: ReadonlyArray<{ items: ReadonlyArray<{ href: string }> }>): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.href.split("?")[0]))
}

test("страницы, ради которых людей ведут, достижимы из меню", () => {
  /* Отзывы о площадке были написаны, наполнялись и стояли в карте сайта,
     но ни в одном меню: увидеть их не мог никто, хотя делались они ради
     доверия к площадке. */
  const footer = allHrefs(FOOTER_NAVIGATION)

  assert.ok(footer.includes("/reviews"), "отзывы недостижимы с сайта")
})

test("в приложении есть помощь, правила и юридические страницы", () => {
  /* Подвал в приложении не рисуется, и других путей к этим страницам нет:
     человек упирался в тупик при первой же трудности. Условия и политика
     к тому же должны быть достижимы отовсюду, где собираются сведения
     о людях. */
  const telegram = allHrefs(TELEGRAM_MENU_NAVIGATION)

  for (const page of ["/help/support", "/help/rules", "/legal/terms", "/legal/privacy"]) {
    assert.ok(telegram.includes(page), `в приложении недостижимо: ${page}`)
  }
})

test("уведомления доступны и в приложении", () => {
  /* Счётчик непрочитанных там уже считался, а раздела не было: человек
     не узнавал, что объявление прошло проверку. */
  assert.ok(allHrefs(TELEGRAM_MENU_NAVIGATION).includes("/notifications"))
})
