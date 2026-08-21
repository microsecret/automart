import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { navbarScrollTop } from "../src/lib/navbar-scroll-sync.ts"

const BASE = {
  contentHeight: 1000,
  viewportHeight: 800,
  pageHeight: 3000,
  windowHeight: 900,
  scrollY: 0,
}

test("вверху страницы меню не смещено", () => {
  assert.equal(navbarScrollTop(BASE), 0)
})

test("внизу страницы меню домотано до конца", () => {
  // Скрытая часть списка — 200px, страница прокручивается на 2100.
  const result = navbarScrollTop({ ...BASE, scrollY: 2100 })
  assert.equal(result, 200)
})

test("на половине страницы меню на половине", () => {
  assert.equal(navbarScrollTop({ ...BASE, scrollY: 1050 }), 100)
})

test("короткий список не трогаем", () => {
  // Иначе меню дёргалось бы там, где прокручивать нечего.
  assert.equal(navbarScrollTop({ ...BASE, contentHeight: 500 }), null)
  assert.equal(navbarScrollTop({ ...BASE, contentHeight: 800 }), null)
})

test("страница без прокрутки не двигает меню", () => {
  assert.equal(navbarScrollTop({ ...BASE, pageHeight: 900 }), null)
  assert.equal(navbarScrollTop({ ...BASE, pageHeight: 600 }), null)
})

test("перелёт за границы страницы не выносит меню за список", () => {
  // Инерционная прокрутка на macOS даёт scrollY больше максимума, а
  // отрицательный — при оттягивании вверх. Меню должно оставаться в пределах.
  assert.equal(navbarScrollTop({ ...BASE, scrollY: 9999 }), 200)
  assert.equal(navbarScrollTop({ ...BASE, scrollY: -300 }), 0)
})

test("результат никогда не превышает скрытую часть списка", () => {
  for (const scrollY of [0, 137, 800, 1500, 2100, 5000]) {
    const result = navbarScrollTop({ ...BASE, scrollY })
    assert.ok(result !== null && result >= 0 && result <= 200, `scrollY=${scrollY} -> ${result}`)
  }
})
