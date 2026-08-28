import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

/* Модуль тянет Prisma через псевдоним «@/», которого запускатель тестов
   не разбирает. Чистая проверка новизны повторена здесь ровно так, как
   написана в модуле, а её текст сверяется отдельным тестом ниже. */
function hasNewSince(input: { lastPostAt: Date; lastVisitAt: Date | null }): boolean {
  if (!input.lastVisitAt) return false
  return input.lastPostAt.getTime() > input.lastVisitAt.getTime()
}

const VISIT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

const hour = 60 * 60 * 1000

test("тема с сообщением после захода помечается новой", () => {
  assert.equal(
    hasNewSince({
      lastPostAt: new Date(Date.now() - hour),
      lastVisitAt: new Date(Date.now() - 2 * hour),
    }),
    true,
  )
})

test("тема без новых сообщений не помечается", () => {
  assert.equal(
    hasNewSince({
      lastPostAt: new Date(Date.now() - 3 * hour),
      lastVisitAt: new Date(Date.now() - hour),
    }),
    false,
  )
})

test("первый заход ничего не подсвечивает", () => {
  /* Прошлого захода нет — подсвечивать нечего, иначе новым оказался бы
     весь форум. */
  assert.equal(hasNewSince({ lastPostAt: new Date(), lastVisitAt: null }), false)
})

test("давний заход не считается прошлым", () => {
  /* Человек, не бывавший здесь полгода, увидел бы новым весь форум — это
     не подсветка, а сплошная заливка. */
  const store = read("../src/lib/forum-visit.ts")
  assert.match(store, /now\.getTime\(\) - previous\.getTime\(\) > VISIT_WINDOW_MS/)
  // Две недели покрывают обычный ритм: заглянул, пропал, вернулся.
  assert.equal(VISIT_WINDOW_MS, 14 * 24 * hour)
})

test("прошлый заход читается до отметки нынешнего", () => {
  /* Запиши мы сначала — подсвечивать было бы нечего, «прошлый заход»
     стал бы этой самой секундой. */
  const store = read("../src/lib/forum-visit.ts")
  const readAt = store.indexOf("select: { forumLastVisitAt: true }")
  const writeAt = store.indexOf("data: { forumLastVisitAt: now }")
  assert.ok(readAt > 0 && writeAt > 0, "чтения или записи нет")
  assert.ok(readAt < writeAt, "запись идёт раньше чтения")
})

test("отметка не задерживает страницу", () => {
  // Она не влияет на то, что показывается сейчас.
  const store = read("../src/lib/forum-visit.ts")
  assert.match(store, /void prisma\.user\s*\n?\s*\.update/)
})

test("гость подсветки не получает", () => {
  const store = read("../src/lib/forum-visit.ts")
  assert.match(store, /if \(!userId\) return null/)
})

test("страница раздела не кэшируется", () => {
  /* Она показывает личное — подсветку именно этого человека. С кэшем её
     увидели бы все одинаковой, из ответа первого зашедшего. */
  const page = read("../src/app/forum/[section]/page.tsx")
  assert.match(page, /export const dynamic = "force-dynamic"/)
  assert.doesNotMatch(page, /export const revalidate/)
})

test("подсветка это точка, а не слово", () => {
  /* Она читается краем глаза при беге по списку, а подпись пришлось бы
     прочитать у каждой из двадцати пяти строк. */
  const css = read("../src/app/globals.css")
  assert.match(css, /\.forum-topic-new \{[\s\S]{0,200}border-radius: 50%/)
  // Признак состояния, а не событие: без движения.
  const rule = css.slice(css.indexOf(".forum-topic-new {"), css.indexOf(".forum-topic-new {") + 300)
  assert.doesNotMatch(rule, /animation:/)
})

test("проверка новизны в тесте совпадает с модулем", () => {
  /* Копия рядом с проверкой легко расходится с исходником: сверяем текст,
     а не полагаемся на память. */
  const store = read("../src/lib/forum-visit.ts")
  assert.match(store, /if \(!input\.lastVisitAt\) return false/)
  assert.match(store, /return input\.lastPostAt\.getTime\(\) > input\.lastVisitAt\.getTime\(\)/)
  assert.match(store, /VISIT_WINDOW_MS = 14 \* 24 \* 60 \* 60 \* 1000/)
})

test("статистика форума считается двумя запросами, а не выборкой", () => {
  /* Участников и последнего пришедшего хватает, а список всех писавших
     ради одной строки тянуть незачем. */
  const page = read("../src/app/forum/page.tsx")
  assert.match(page, /prisma\.user\.count\(\{ where: \{ forumPostCount: \{ gt: 0 \} \} \}\)/)
  assert.match(page, /orderBy: \{ createdAt: "desc" \}/)
})

test("статистика не показывается на пустом форуме", () => {
  // «Тем: 0, сообщений: 0» выглядит хуже, чем отсутствие строки.
  const page = read("../src/app/forum/page.tsx")
  assert.match(page, /allTopics > 0 && \(/)
})
