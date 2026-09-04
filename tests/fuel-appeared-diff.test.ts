import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { diffFuelAvailability } from "../src/lib/fuel-appeared-diff.ts"

test("появление марки замечается", () => {
  /* Главное событие сервиса: на заправке было пусто, привезли 95-й.
     За сутки водители оставляют одну-две отметки, а источники приносят
     изменения по четырнадцати тысячам заправок — именно там это видно. */
  const change = diffFuelAvailability(
    { status: "no", fuelsNow: null },
    { status: "yes", fuelsNow: "AI95" },
  )

  assert.deepEqual(change.appeared, ["AI95"])
  assert.equal(change.becameAvailable, true)
})

test("первый прогон появлением не считается", () => {
  /* Иначе при заведении нового города в чат ушла бы тысяча сообщений
     разом: все заправки «появились» бы одновременно. */
  const change = diffFuelAvailability(null, { status: "yes", fuelsNow: "AI92,AI95" })
  assert.deepEqual(change.appeared, [])
})

test("молчание источника — не то же самое, что отсутствие топлива", () => {
  /* Разница между «не знали» и «не было» здесь принципиальна: без неё
     каждый новый источник давал бы волну ложных сообщений о появлении
     того, что и так стояло. */
  const change = diffFuelAvailability(
    { status: null, fuelsNow: null },
    { status: "yes", fuelsNow: "AI95" },
  )
  assert.deepEqual(change.appeared, [])
})

test("список марок при пустой заправке не считается наличием", () => {
  /* Источник со статусом «нет» и непустым списком перечисляет
     ассортимент колонок, а не то, что залито. Сообщать по нему значило
     бы звать людей туда, где заправиться нечем. */
  const change = diffFuelAvailability(
    { status: "no", fuelsNow: null },
    { status: "no", fuelsNow: "AI92,AI95,DT" },
  )
  assert.deepEqual(change.appeared, [])
})

test("прежние марки повторно не объявляются", () => {
  /* Иначе каждый прогон сбора слал бы в чат одно и то же: топливо на
     заправке стоит сутками, а прогон идёт каждые пятнадцать минут. */
  const change = diffFuelAvailability(
    { status: "yes", fuelsNow: "AI92,AI95" },
    { status: "yes", fuelsNow: "AI92,AI95" },
  )
  assert.deepEqual(change.appeared, [])
})

test("добавление марки к уже работающей заправке замечается", () => {
  /* Заправка работала на 92-м, привезли 95-й — это новость для тех, кто
     ездит на 95-м, хотя сама заправка не «ожила». */
  const change = diffFuelAvailability(
    { status: "yes", fuelsNow: "AI92" },
    { status: "yes", fuelsNow: "AI92,AI95" },
  )

  assert.deepEqual(change.appeared, ["AI95"])
  assert.equal(change.becameAvailable, false)
})

test("регистр и пробелы в списке марок не мешают", () => {
  /* Источники пишут по-разному, и «ai95» с пробелом не должен выглядеть
     новой маркой рядом с «AI95». */
  const change = diffFuelAvailability(
    { status: "yes", fuelsNow: " ai95 , dt " },
    { status: "yes", fuelsNow: "AI95,DT" },
  )
  assert.deepEqual(change.appeared, [])
})
