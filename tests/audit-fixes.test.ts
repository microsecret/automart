import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

/**
 * Проверки по итогам аудита фронтенда и бэкенда.
 *
 * Каждый тест закрепляет исправление, найденное при разборе проекта, —
 * чтобы дефект не вернулся при следующей правке рядом.
 */

test("лента в мини-приложении не ждёт входа", () => {
  /* Человек открывал мини-приложение и вместо машин видел «Открываем
     ваш аккаунт…» до конца авторизации. Смотреть машины можно и без
     входа: он нужен для избранного и переписки. */
  const app = readFileSync(new URL("../src/components/telegram/TelegramMiniApp.tsx", import.meta.url), "utf8")
  const feedAt = app.indexOf("<TelegramFeed />")
  const loaderGuard = app.indexOf('status === "loading" && (')
  assert.ok(loaderGuard > 0, "состояние входа должно быть неблокирующим")
  assert.ok(feedAt > 0, "лента должна рендериться")
  /* Переписка — исключение: без входа там показывать нечего. */
  assert.match(app, /Открываем переписку/)
})

test("счётчик диалогов не выгружает весь почтовый ящик", () => {
  /* groupBy без ограничения возвращал по строке на каждый диалог, в
     котором человек когда-либо участвовал, — ради одного числа в
     пагинации. Ящик открывался тем медленнее, чем дольше человек
     пользуется сервисом. */
  const route = readFileSync(new URL("../src/app/api/messages/route.ts", import.meta.url), "utf8")
  assert.match(route, /COUNT\(DISTINCT "conversationId"\)/)
  /* Приведения типов PostgreSQL здесь быть не должно: база — SQLite. */
  assert.doesNotMatch(route, /::bigint/)
})

test("справочники марок и категорий кэшируются", () => {
  /* Марки и модели лежат в коде: ответ байт в байт одинаков и меняется
     только с выкатом. Заголовка не было, и каждый выпадающий список
     шёл до сервера заново. */
  for (const file of ["../src/app/api/v1/brands/route.ts", "../src/app/api/v1/models/route.ts", "../src/app/api/categories/route.ts"]) {
    const route = readFileSync(new URL(file, import.meta.url), "utf8")
    assert.match(route, /Cache-Control/, `нет заголовка кэша: ${file}`)
    assert.match(route, /stale-while-revalidate/, `нет фонового обновления: ${file}`)
  }
})

test("поиск запчастей не бьёт по серверу на каждую букву", () => {
  /* Поле входило в ключ запроса напрямую: набирая «тормозной диск»,
     человек отправлял тринадцать запросов подряд. */
  const page = readFileSync(new URL("../src/app/parts-finder/page.tsx", import.meta.url), "utf8")
  assert.match(page, /debouncedQ/)
  assert.match(page, /setDebouncedQ\(q\), 350/)
  assert.match(page, /u\.set\("q", debouncedQ\)/)
})

test("прокрутка не пересчитывает раскладку на каждое событие", () => {
  /* Браузер шлёт до сотни событий в секунду, и на каждом читались
     getBoundingClientRect и scrollHeight — то есть раскладка страницы
     пересчитывалась заново. */
  const layout = readFileSync(new URL("../src/components/layout/AppShellLayout.tsx", import.meta.url), "utf8")
  assert.match(layout, /requestAnimationFrame/)
  assert.match(layout, /addEventListener\("scroll", scheduleUpdate/)
  assert.match(layout, /cancelAnimationFrame/)
})

test("кабинет не передёргивает тяжёлую статистику при возврате на вкладку", () => {
  /* Шапка и меню просят тот же адрес с паузой в двадцать секунд; из-за
     расхождения кабинет сбрасывал общий кэш. */
  const page = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8")
  const call = page.slice(page.indexOf('"/api/dashboard/stats"'), page.indexOf('"/api/dashboard/stats"') + 260)
  assert.match(call, /revalidateOnFocus: false/)
  assert.match(call, /dedupingInterval: 20_000/)
})

test("цена похожего лота подписана тем же смыслом, что в списке", () => {
  /* Поле finalPrice было подписано «предварительно под ключ», хотя
     пошлины и доставки в этой сумме нет: на живых лотах разница
     доходила до четырёхсот тысяч рублей. */
  const page = readFileSync(new URL("../src/app/auctions/[id]/page.tsx", import.meta.url), "utf8")
  assert.doesNotMatch(page, /предварительно под ключ/)
})

test("кнопки категорий запчастей дорастают до пальца на телефоне", () => {
  /* Тридцать пикселей — половина от того, во что человек уверенно
     попадает на ходу, а кнопки стоят в ряду с прокруткой: промах
     утаскивает ленту вбок. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const mobile = css.slice(css.indexOf(".parts-category-bar .mantine-Button-root"))
  assert.match(mobile.slice(0, 900), /min-height: 44px/)
})
