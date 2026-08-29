import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { formatAge, isFresh, summarizeAvailability } from "../src/lib/fuel-availability.ts"

const NOW = new Date("2026-08-29T12:00:00Z")
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)

test("одна отметка «есть» показывает наличие", () => {
  const [row] = summarizeAvailability([{ fuel: "AI92", state: "YES", createdAt: ago(10) }], NOW)
  assert.equal(row.state, "YES")
  assert.equal(row.confirmations, 1)
})

test("при равенстве побеждает «нет»", () => {
  /* Съездить зря хуже, чем не поехать: человек, приехавший к пустой
     колонке, теряет полчаса и бак, а не поехавший — ничего. */
  const rows = summarizeAvailability([
    { fuel: "AI95", state: "YES", createdAt: ago(20) },
    { fuel: "AI95", state: "NO", createdAt: ago(15) },
  ], NOW)
  assert.equal(rows[0].state, "NO")
})

test("свежие отметки перевешивают старые", () => {
  /* Утреннее «нет» и дневное «есть»: подвоз был, и карта должна это
     показывать. */
  const rows = summarizeAvailability([
    { fuel: "AI92", state: "NO", createdAt: ago(400) },
    { fuel: "AI92", state: "YES", createdAt: ago(30) },
    { fuel: "AI92", state: "YES", createdAt: ago(20) },
  ], NOW)
  assert.equal(rows[0].state, "YES")
  assert.equal(rows[0].confirmations, 2)
})

test("вчерашние отметки не показываются", () => {
  // Вчерашнее «есть 92» не помогает никому.
  const rows = summarizeAvailability([{ fuel: "AI92", state: "YES", createdAt: ago(60 * 30) }], NOW)
  assert.equal(rows.length, 0)
})

test("молчание о топливе — не отсутствие", () => {
  /* Про 98-й никто не отмечал: это значит «не смотрели», а не «нет». В
     сводке его быть не должно вовсе. */
  const rows = summarizeAvailability([{ fuel: "AI92", state: "YES", createdAt: ago(10) }], NOW)
  assert.equal(rows.some((row) => row.fuel === "AI98"), false)
})

test("очередь берётся худшая из свежих", () => {
  /* Человек в хвосте сообщает, заправившийся сразу молчит. Занизить
     очередь хуже: во втором случае человек приедет готовым ждать. */
  const rows = summarizeAvailability([
    { fuel: "AI92", state: "YES", queue: "NONE", createdAt: ago(30) },
    { fuel: "AI92", state: "YES", queue: "BIG", createdAt: ago(20) },
  ], NOW)
  assert.equal(rows[0].queue, "BIG")
})

test("у «нет» очереди не бывает", () => {
  // Стоять не за чем.
  const rows = summarizeAvailability([
    { fuel: "AI92", state: "NO", queue: "BIG", createdAt: ago(10) },
  ], NOW)
  assert.equal(rows[0].queue, null)
})

test("мусор в отметках не роняет сводку", () => {
  const rows = summarizeAvailability([
    { fuel: "ЧТО-ТО", state: "YES", createdAt: ago(10) },
    { fuel: "AI92", state: "ВОЗМОЖНО", createdAt: ago(10) },
    { fuel: "AI92", state: "YES", createdAt: ago(10) },
  ], NOW)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].fuel, "AI92")
})

test("возраст отметки читается словами", () => {
  assert.equal(formatAge(ago(0), NOW), "только что")
  assert.equal(formatAge(ago(20), NOW), "20 мин назад")
  assert.equal(formatAge(ago(150), NOW), "2 ч назад")
  assert.equal(formatAge(ago(60 * 26), NOW), "вчера")
  assert.equal(formatAge(null, NOW), null)
})

test("свежесть отделяет сведение от воспоминания", () => {
  // Шестичасовое «есть» — сведение, вчерашнее — воспоминание.
  assert.equal(isFresh(ago(60), NOW), true)
  assert.equal(isFresh(ago(60 * 7), NOW), false)
  assert.equal(isFresh(null, NOW), false)
})

// === Устройство маршрута и карты ===

test("отметка наличия не заменяет прежнюю, а добавляется", () => {
  /* У цены голос один и уточняется, а у наличия накопление подтверждений
     и есть суть: «есть 92, отметили пятеро» весит больше одной отметки. */
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  /* Проверяем именно отметки наличия: updateMany в файле есть, но он
     относится к цене — у неё голос один и уточняется, тогда как у
     наличия накопление подтверждений и есть суть. */
  assert.doesNotMatch(route, /fuelAvailabilityReport\.updateMany/)
  assert.match(route, /fuelAvailabilityReport\.create/)
})

test("анонимные отметки ограничены строже", () => {
  // Накрутка с одного адреса красит карту целиком.
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /userId\s*\n?\s*\?\s*\{ windowMs: 60 \* 60 \* 1_000, maxRequests: 40 \}/)
  assert.match(route, /maxRequests: 10/)
})

test("адрес не хранится, только его хеш", () => {
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /createHash\("sha256"\)/)
})

test("очередь сохраняется только при «есть»", () => {
  // Стоять не за чем.
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /queue: state === "YES" \? queue : null/)
})

test("наличие показывается выше цены", () => {
  /* В дефицит человек ищет не «где дешевле», а «где вообще есть». */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  const availabilityAt = page.indexOf("<FuelAvailabilityReporter")
  const priceAt = page.indexOf("<FuelPriceReporter")
  assert.ok(availabilityAt > 0 && priceAt > 0)
  assert.ok(availabilityAt < priceAt, "наличие должно идти раньше цены")
})

// === Метки на карте ===

test("цвет метки идёт от отметок, а не от тегов OpenStreetMap", () => {
  /* Теги говорят про ассортимент вообще, отметки — про наличие сейчас.
     Человек смотрит на карту со вторым вопросом. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /data-reported=\{!isCluster && fresh\.length/)
})

test("плашка показывается только вблизи", () => {
  /* На весь город плашек сотни, они перекрывают друг друга, и карта
     перестаёт читаться. Далеко остаётся мелкий кружок. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /showPlate = !isCluster && zoom >= 12/)
})

test("на плашке видны бренд, марки и цена", () => {
  /* Кружок отвечал только «здесь заправка»: за сетью, наличием и ценой
     надо было открывать карточку. Человек за рулём так не делает. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /fuel-map-plate__logo/)
  assert.match(page, /fuel-map-plate__fuel/)
  assert.match(page, /fuel-map-plate__price/)
})

test("цена на плашке приходит одним запросом на все точки", () => {
  // По одному на точку вышло бы триста запросов на открытие карты.
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /nearbyPricesData/)
})

test("на метке только свежие отметки", () => {
  // Вчерашнее «есть 92» на карте хуже, чем ничего.
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /isFresh\(new Date\(row\.updatedAt\)\)/)
})

test("состояние читается не только цветом", () => {
  /* Зачёркнутая марка понятна и при дальтонизме, и на выцветшем экране
     под солнцем. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  assert.match(css, /fuel-map-plate__fuel\[data-state="no"\][\s\S]{0,160}line-through/)
})

test("тег OpenStreetMap на плашке отличается от отметки водителя", () => {
  /* Тег говорит про ассортимент вообще, отметка — про наличие сейчас.
     Путать их нельзя: человек поедет за топливом, которого нет. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  assert.match(css, /fuel-map-plate__fuel\[data-state="unknown"\]/)
})

test("цвета обозначений совпадают с цветами меток", () => {
  /* Разойдись они на тон, и подпись перестала бы объяснять карту.
     Наличие показывается кольцом, а не заливкой: заливка затирала цвет
     сети, и человек переставал отличать Лукойл от Роснефти. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")

  for (const [state, expected] of [["yes", "#16a34a"], ["no", "#dc2626"]] as const) {
    const marker = css.slice(css.indexOf(`fuel-map-marker[data-reported="${state}"]`))
    assert.ok(marker.slice(0, 140).includes(expected), `у метки «${state}» другой цвет`)

    const legend = css.slice(css.indexOf(`legend > span[data-reported="${state}"]`))
    assert.ok(legend.slice(0, 100).includes(expected), `у обозначения «${state}» другой цвет`)
  }
})

test("цвет сети виден и при отметках", () => {
  /* Заливка по наличию затирала фирменный цвет: заправка становилась
     просто зелёной, и человек переставал узнавать свою сеть. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /networkIdentity && !isCluster\s*\?\s*\{ backgroundColor/)
})

test("снимок берётся из самой свежей отметки", () => {
  /* Фотография часовой давности говорит о заправке больше, чем
     вчерашняя, даже если вчерашняя чётче. */
  const rows = summarizeAvailability([
    { fuel: "AI92", state: "YES", photo: "/uploads/old.jpg", createdAt: ago(120) },
    { fuel: "AI92", state: "YES", photo: "/uploads/new.jpg", createdAt: ago(10) },
  ], NOW)
  assert.equal(rows[0].photo, "/uploads/new.jpg")
})

test("снимок проигравшего состояния не показывается", () => {
  /* Победило «нет», а снимок был у «есть»: показать его значило бы
     подтвердить фотографией то, чего карта не утверждает. */
  const rows = summarizeAvailability([
    { fuel: "AI92", state: "YES", photo: "/uploads/yes.jpg", createdAt: ago(30) },
    { fuel: "AI92", state: "NO", createdAt: ago(20) },
    { fuel: "AI92", state: "NO", createdAt: ago(10) },
  ], NOW)
  assert.equal(rows[0].state, "NO")
  assert.equal(rows[0].photo, null)
})

test("отметка без снимка не ломает сводку", () => {
  const rows = summarizeAvailability([{ fuel: "AI92", state: "YES", createdAt: ago(10) }], NOW)
  assert.equal(rows[0].photo, null)
  assert.equal(rows[0].comment, null)
})

test("чужая ссылка вместо снимка не принимается", () => {
  /* Без проверки в поле легла бы любая ссылка, и карта показывала бы
     картинку с постороннего сайта под видом фотографии колонки. */
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.ok(route.includes(".test(rawPhoto)"), "адрес снимка должен проверяться")
  assert.ok(route.includes("uploads"), "принимаются только свои файлы")
})

test("комментарий обрезается до подписи", () => {
  // Длинный не поместится в карточке и превратит карту в переписку.
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /slice\(0, 200\)/)
})

test("на телефоне открывается камера, а не галерея", () => {
  // Человек снимает колонку, а не ищет её среди своих фотографий.
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /capture="environment"/)
})

test("снимок не обязателен для отметки", () => {
  /* Человек у колонки отмечает за две секунды. Требовать снимок значило
     бы получать отметки от единиц. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /state: "YES", null\)|send\(openFuel, "YES", null\)/)
})

// === Цена ===

test("цена ставится вместе с наличием", () => {
  /* Раньше она жила отдельным блоком: человек отмечал топливо, закрывал
     карточку и уезжал, а цену не ставил никто. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /Есть, по этой цене/)
  assert.match(reporter, /price: price \|\| null/)
})

test("цена необязательна", () => {
  // Нажал «есть» — записалось и без цены, отметка остаётся делом двух секунд.
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /priceRub !== null/)
})

test("цена не сохраняется, когда топлива нет", () => {
  /* «Нет 92 по 60 рублей» бессмысленно, а в согласованную цену такая
     отметка попала бы. */
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /priceRub !== null && state === "YES"/)
})

test("сбой записи цены не отменяет отметку наличия", () => {
  // Наличие важнее, и человек уже нажал кнопку.
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /Запись цены/)
})

test("знак сети виден на плашке", () => {
  /* Цветной полоски было мало: человек видел «красную» заправку, но не
     понимал, Лукойл это или Опти. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /fuel-map-plate__logo/)
  assert.match(page, /networkIdentity\.shortLabel/)
})

test("нераспознанная сеть не ломает плашку", () => {
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /data-unknown="true"/)
})

// === Исправления по жалобам ===

test("подтверждение не лезет постоянно", () => {
  /* Условием была «не высокая» уверенность — а средняя бывает почти
     всегда, и плашка висела поверх поля цены. Вопрос, который задают
     каждый раз, перестают читать. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /confidenceLabel !== "низкая"/)
  assert.match(reporter, /60 \* 60 \* 1000/)
})

test("подтверждение прячется, пока открыта форма отметки", () => {
  // Человек уже отвечает на тот же вопрос кнопками выше.
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /if \(!stale \|\| openFuel\) return null/)
})

test("без геолокации список считает от центра карты", () => {
  /* Список без положения бесполезнее, чем с приблизительным: человек всё
     равно видит, где топливо есть. */
  const nearby = readFileSync(new URL("../src/components/fuel/FuelNearbyList.tsx", import.meta.url), "utf8")
  assert.match(nearby, /fallbackOrigin/)
})

test("причина отказа геолокации объясняется по-разному", () => {
  /* Общее «не удалось» не говорило, отказал ли человек сам, слаб ли
     сигнал или дело в браузере. */
  const nearby = readFileSync(new URL("../src/components/fuel/FuelNearbyList.tsx", import.meta.url), "utf8")
  assert.match(nearby, /failure\?\.code === 1/)
  assert.match(nearby, /failure\?\.code === 3/)
})

test("всплывающая карточка показывает наличие и цену", () => {
  /* Раньше в ней были только адрес и ассортимент из OpenStreetMap —
     ответа на вопрос «есть ли бензин» не было. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /Здесь ещё не отмечали наличие/)
  assert.match(page, /priceByFuel\.get\(row\.fuel\)/)
})

test("из карточки на карте можно отметить и построить маршрут", () => {
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.ok(page.includes("Отметить"), "кнопка отметки")
  assert.match(page, /yandex\.ru\/maps\/\?rtext/)
})

test("цена обновляется в карточке сразу после отметки", () => {
  /* Цена уходит вместе с наличием, но живёт в своём запросе: без
     обновления человек видел «цен пока никто не отмечал» и ставил
     снова, решив, что не сохранилось. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /mutateNearbyPrices/)
  assert.match(page, /mutateReportedPrices\(\)/)
})

test("цену можно исправить нажатием", () => {
  /* Раньше её нельзя было поправить: человек видел устаревшую цену и не
     мог её изменить, не разбираясь, где отдельная кнопка. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelPriceReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /component="button"/)
  assert.match(reporter, /setPrice\(\(entry\.priceKopecks \/ 100\)/)
})

test("комментарии видны без фотографии", () => {
  /* Раньше комментарий показывался только под снимком: без него
     пропадал, хотя именно текст часто и есть главное — «на табло не
     горит, по факту есть», «лимит 30 литров». */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /item\.comment && item\.updatedAt/)
})

test("в карточке на карте видно расстояние", () => {
  // «1,2 км» отвечает на вопрос «далеко ли» без открытия маршрута.
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /getDistanceInKilometers\(coordinates, selectedStation\)/)
})

test("плашки читаются на телефоне", () => {
  /* Кегль 10 и ширина 168 под солнцем не разбираются, а смотрят на карту
     именно там. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const plate = css.slice(css.indexOf(".fuel-map-plate {"))
  assert.match(plate.slice(0, 600), /max-width: 210px/)
})
