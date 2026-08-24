import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { formatAdminDate, formatAdminDateTime, formatAdminDateTimeShort } from "../src/lib/admin-datetime.ts"

test("время показывается по Москве, а не по поясу браузера", () => {
  // Полночь UTC — это три часа ночи в Москве. Прежде одна страница
  // показывала екатеринбургское время, другая — браузерное, и сверить
  // «когда пришла заявка» с «когда зарегистрировался» было нельзя.
  const utcMidnight = new Date("2026-08-24T00:00:00Z")
  assert.match(formatAdminDateTime(utcMidnight), /03:00/)
})

test("пояс подписан", () => {
  // Без подписи непонятно, чьё это время: у площадки продавцы от
  // Калининграда до Владивостока.
  assert.match(formatAdminDateTime("2026-08-24T12:00:00Z"), /МСК$/)
})

test("дата и время разделены точкой, а не запятой", () => {
  // «24 авг., 15:00» читается как перечисление: запятая сливается с
  // сокращением месяца.
  const text = formatAdminDateTime("2026-08-24T12:00:00Z")
  assert.match(text, /·/)
  assert.doesNotMatch(text, /,/)
})

test("полная отметка содержит год", () => {
  // Регистрации и платежи живут долго: без года «24 авг.» бессмысленно.
  assert.match(formatAdminDateTime("2026-08-24T12:00:00Z"), /2026/)
})

test("короткая отметка года не содержит", () => {
  // В ленте обращений всё произошло недавно, и год только занимает место.
  const short = formatAdminDateTimeShort("2026-08-24T12:00:00Z")
  assert.doesNotMatch(short, /2026/)
  assert.match(short, /15:00/)
})

test("переход через полночь по московскому времени", () => {
  // 22:30 UTC — это уже следующий день в Москве. Событие, записанное
  // вечером, не должно показываться вчерашним.
  assert.match(formatAdminDateTime("2026-08-23T22:30:00Z"), /24 авг/)
})

test("отсутствующее значение показывается прочерком", () => {
  // Пустая ячейка непонятна: данных нет или их не показали.
  assert.equal(formatAdminDateTime(null), "—")
  assert.equal(formatAdminDateTimeShort(undefined), "—")
  assert.equal(formatAdminDate(""), "—")
})

test("испорченная дата не роняет страницу", () => {
  assert.equal(formatAdminDateTime("не дата"), "—")
  assert.equal(formatAdminDate("2026-13-45"), "—")
})

test("объект Date принимается наравне со строкой", () => {
  // Prisma отдаёт Date, а ответ API — строку: формат должен принимать оба.
  const iso = "2026-08-24T12:00:00Z"
  assert.equal(formatAdminDateTime(new Date(iso)), formatAdminDateTime(iso))
})

test("только дата — без времени", () => {
  const text = formatAdminDate("2026-08-24T12:00:00Z")
  assert.match(text, /24 авг/)
  assert.doesNotMatch(text, /15:00/)
})
