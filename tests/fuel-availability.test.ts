import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { getStationIdentity } from "../src/lib/fuel-station-identity.ts"
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
  assert.match(route, /entry\.state === "YES" \? queue : null/)
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

test("наличие красит метку, сеть остаётся там, где наличие неизвестно", () => {
  /* Кольцо в три пикселя вокруг фирменного цвета терялось на карте с
     домами и дорогами: человек, ищущий бензин, видел мешанину цветов
     сетей вместо ответа. Теперь наличие красит кружок целиком, а
     фирменный цвет остаётся там, где отметок нет. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /networkIdentity && !isCluster && fresh\.length === 0/)
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  assert.match(css, /\.fuel-map-marker\[data-reported="yes"\] \{\s*background: #16a34a/)
  assert.match(css, /\.fuel-map-marker\[data-reported="no"\] \{\s*background: #dc2626/)
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
  assert.match(reporter, /disabled=\{filled\.length === 0\}/)
})

// === Цена ===

test("цена ставится вместе с наличием, по всем маркам разом", () => {
  /* Человек стоит у табло, где все цены сразу. Вводить их по одной
     марке — значит открывать форму пять раз; за рулём этого не делают. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /entries: filled\.map/)
  assert.match(reporter, /price: row\.price \|\| null/)
})

test("цена необязательна", () => {
  // Нажал «есть» — записалось и без цены.
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /if \(entry\.price === null\) continue/)
})

test("цена не сохраняется, когда топлива нет", () => {
  /* «Нет 92 по 60 рублей» бессмысленно, а в согласованную цену такая
     отметка попала бы. */
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /raw\.state === "YES" \? parseReportedPrice/)
})

test("сбой записи цены не отменяет отметку наличия", () => {
  // Наличие важнее, и человек уже нажал кнопку.
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /Запись цены/)
})

test("знак есть у всех точек карты", () => {
  /* Цветной полоски было мало: человек видел «красную» заправку, но не
     понимал, Лукойл это или Опти. А нераспознанные точки получали
     серый значок без подписи и читались как поломка — таких больше
     четырёхсот на десять городов. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /fuel-map-plate__logo/)
  assert.match(page, /plateIdentity\.shortLabel/)

  /* Запасной вид берётся по ассортименту: газовая, зарядка или АЗС —
     проверяем поведение, а не строку в файле. */
  for (const name of ["Лукойл", "АЗС", "АГЗС", "Зарядка"]) {
    const identity = getStationIdentity({ name, fuels: [] })
    assert.ok(identity.shortLabel.length > 0, `нет знака у «${name}»`)
  }
})

test("безымянная заправка получает вид по ассортименту", () => {
  /* У трёхсот семидесяти точек название буквально «АЗС», ещё у сорока
     «АГЗС». Названия не будет, но тип колонок известен. */
  /* Газовую от бензиновой человек с ГБО различает первым делом. */
  assert.equal(getStationIdentity({ name: "АГЗС", fuels: [] }).label, "Газовая АЗС")
  assert.equal(getStationIdentity({ name: "Зарядка", fuels: ["EV"] }).label, "Зарядка EV")
  assert.equal(getStationIdentity({ name: "АЗС", fuels: ["АИ-95"] }).label, "АЗС")
})

// === Исправления по жалобам ===

test("незаполненные марки не уходят на сервер", () => {
  /* Пустая строка — это «не смотрел», а не «нет». Присылать её значило
     бы записывать отсутствие топлива там, где человек просто не глядел. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /filter\(\(row\) => row\.state !== null\)/)
})

test("очередь одна на заправку", () => {
  /* Она не бывает разной у 92-го и 95-го — машины стоят в общую. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /Очередь одна на заправку/)
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

test("отметка наличия делается прямо в карточке на карте", () => {
  /* Раньше форма жила в списке сбоку: человек нажимал метку на карте,
     потом искал ту же заправку в списке справа и только там мог
     отметить. Списка больше нет, форма стоит в карточке. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /<FuelAvailabilityReporter/)
  assert.match(page, /selectedStationAvailability/)
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
  assert.match(reporter, /<UnstyledButton\s+key=\{entry\.fuel\}/)
  assert.match(reporter, /setPrice\(\(entry\.priceKopecks \/ 100\)/)
})

test("у цены видно, насколько ей верить", () => {
  /* Цена показывалась как факт: за «АИ-92 · 63,70 ₽ · 1» могла стоять
     одна отметка пятичасовой давности, и человек ехал платить на три
     рубля больше. Число подтверждений рядом читалось как порядковый
     номер, а не как надёжность. */
  const consensus = readFileSync(new URL("../src/lib/fuel-price-reports.ts", import.meta.url), "utf8")
  assert.match(consensus, /calculateConfidence/)
  assert.match(consensus, /confidencePercent/)
  /* Отметка вошедшего весит больше — как и у наличия. */
  assert.match(consensus, /authorized: Boolean\(report\.userId\)/)

  const reporter = readFileSync(new URL("../src/components/fuel/FuelPriceReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /fuel-price-row__meter/)

  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  /* Цвет несёт то же, что и длина полосы: слабую цену видно, не
     сравнивая полосы между собой. */
  assert.match(css, /data-level="низкая"\] > span \{ background: #dc2626/)
})

test("комментарии видны без фотографии и не обрезаны тремя", () => {
  /* Раньше комментарий показывался только под снимком: без него
     пропадал, хотя именно текст часто и есть главное — «на табло не
     горит, по факту есть», «лимит 30 литров».

     Теперь у комментариев своя вкладка в карточке: показываются все, а
     не три последних, и свежие сверху. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /row\.comment && row\.updatedAt/)
  assert.match(page, /const stationNotes/)
  assert.match(page, /activeTab === "notes"/)
  /* Прежнего обрезания до трёх быть не должно. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.doesNotMatch(reporter, /\.slice\(0, 3\)/)
})

test("карточка разделена на вкладки", () => {
  /* Карточка выкладывала всё одной лентой: марки, форма, кнопки, цены,
     чужие комментарии. На телефоне до цен надо было прокрутить
     полтора экрана, и человек их не находил. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /fuel-card-tabs/)
  assert.match(page, /activeTab === "report"/)
  assert.match(page, /activeTab === "prices"/)
  /* Наличие остаётся над вкладками: это главный ответ, ради которого
     карточку открыли, и прятать его за нажатие нельзя. */
  const tabsAt = page.indexOf("fuel-card-tabs")
  const freshAt = page.indexOf("fresh.slice(0, 6)")
  assert.ok(freshAt > 0 && freshAt < tabsAt, "марки должны стоять выше вкладок")
})

test("наведение на метку не стирает цвет наличия", () => {
  /* Раньше hover красил метку тёмно-синим: наведя курсор на зелёную
     заправку, человек видел синюю и терял ответ ровно в тот момент,
     когда к ней тянулся. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const hoverBlock = css.slice(css.indexOf(".fuel-map-marker:hover"), css.indexOf(".fuel-map-marker:hover") + 400)
  assert.doesNotMatch(hoverBlock, /background: #1c4291/)
  /* Выбранная метка пульсирует, потому что карточка закрывает часть
     карты и человек терял из виду, какую точку нажал. */
  assert.match(css, /fuel-marker-pulse/)
})

test("в карточке на карте видно расстояние", () => {
  // «1,2 км» отвечает на вопрос «далеко ли» без открытия маршрута.
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /getDistanceInKilometers\(coordinates, selectedStation\)/)
})

test("плашки читаются на телефоне", () => {
  /* Мелкий кегль под солнцем не разбирается, а смотрят на карту именно
     там. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const plate = css.slice(css.indexOf(".fuel-map-plate {"))
  assert.match(plate.slice(0, 700), /max-width: 2[0-9]{2}px/)
})

// === Охват карты ===

test("точки подгружаются сами при движении карты", () => {
  /* Раньше надо было нажать «Загрузить участок»: человек двигал карту к
     своему посёлку, видел пустоту и решал, что заправок там нет. В
     Чекмагуше их двадцать в радиусе сорока километров. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /setRequestedCoordinates\(viewportCoordinates\)\s*\}, 1500\)/)
})

test("предел точек берёт Москву целиком", () => {
  /* Замерено на живых данных: в радиусе 40 км от центра Москвы 1235
     заправок. Прежние 600 обрезали её ровно вдвое — окраины на карту не
     попадали вовсе. Предел поднят вместе с радиусом за городом. */
  const route = readFileSync(new URL("../src/app/api/fuel-stations/route.ts", import.meta.url), "utf8")
  assert.match(route, /out center tags 2500;/)
})

test("за городом радиус охвата шире", () => {
  /* Сорок километров рассчитаны на город. На трассе в том же круге
     полтора десятка заправок, и человек видел пустую карту там, где
     они стоят через тридцать-сорок километров. */
  const route = readFileSync(new URL("../src/app/api/fuel-stations/route.ts", import.meta.url), "utf8")
  /* Радиус выбирается по расстоянию до ближайшего города, а не по
     тому, пришли ли координаты с карты: иначе сдвиг карты внутри
     Москвы переключал радиус с тридцати двух километров на восемьдесят,
     запрос тяжелел вчетверо и промахивался мимо кэша. */
  assert.match(route, /nearestCityDistance <= 50 \? 32_000 : 80_000/)
  /* Широкий радиус в городе упёрся бы в таймаут Overpass — на этот
     случай запрос повторяется вдвое уже. */
  assert.match(route, /retrying with a smaller radius/)
})

test("в карточке видно расстояние до заправки", () => {
  /* Список рядом с картой убран: строка «Роснефть, 1,1 км» не
     показывает, по пути это или в обратную сторону. Расстояние
     осталось там, где человек читает про саму заправку. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /const distanceKm = getDistanceInKilometers\(coordinates, selectedStation\)/)
})

test("заправкой можно поделиться в сети, которыми пользуются", () => {
  /* Человек нашёл, где есть бензин, и первое, что делает, — говорит
     другу. Прежняя кнопка на настольном браузере молча копировала
     ссылку: нажал, ничего не произошло, непонятно, сработало ли. */
  const share = readFileSync(new URL("../src/components/fuel/FuelShareButton.tsx", import.meta.url), "utf8")
  assert.match(share, /t\.me\/share\/url/)
  assert.match(share, /vk\.com\/share\.php/)
  assert.match(share, /api\.whatsapp\.com\/send/)
  assert.match(share, /navigator\.share/)
  assert.match(share, /clipboard\.writeText/)
  /* Подтверждение обязательно: без него человек жмёт «скопировать»
     второй раз, не зная, сработало ли. */
  assert.match(share, /Скопировано/)
})

test("в тексте для отправки есть наличие, цены и свежесть", () => {
  /* «Есть: 92» получатель читал как загадку: 92 чего, у кого, когда.
     Без цены и свежести сообщение не отвечает на вопрос, ради
     которого его шлют. */
  const share = readFileSync(new URL("../src/components/fuel/FuelShareButton.tsx", import.meta.url), "utf8")
  assert.match(share, /Есть в наличии: \$\{availableFuels\.join/)
  assert.match(share, /Цены: \$\{priceSummary\}/)
  assert.match(share, /По отметкам водителей/)

  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /availableFuels=\{availableFuels\}/)
  assert.match(page, /priceSummary=\{sharePriceSummary\}/)
})

test("ссылка из «поделиться» ведёт на нашу карту, а не в Яндекс", () => {
  /* Человек пересылал другу ссылку на Яндекс.Карты: тот видел точку на
     чужой карте, где нет ни наличия, ни цен, ни возможности отметить.
     Сервис отдавал свою находку конкуренту и не получал ни одного
     нового человека. */
  const share = readFileSync(new URL("../src/components/fuel/FuelShareButton.tsx", import.meta.url), "utf8")
  assert.match(share, /\/services\/fuel-map\?station=/)
  assert.doesNotMatch(share, /yandex\.ru\/maps/)

  /* По такой ссылке карта открывается сразу на нужной заправке. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /searchParams\.get\("station"\)/)
  assert.match(page, /setSelectedStation\(target\)/)
})

test("форма не спрашивает про топливо, которого на заправке нет", () => {
  /* На газовой АЗС человек видел вопрос про 92-й, которого там не
     бывает, и наоборот. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /const visibleFuels/)
  assert.match(reporter, /hasGas/)
  /* Но живая отметка вернее тега: если марку уже отмечали, она
     остаётся, потому что теги в OSM часто неполны. */
  assert.match(reporter, /!== "UNKNOWN"\) return true/)
  /* И если после сужения не осталось ничего — показываем всё. */
  assert.match(reporter, /narrowed\.length \? narrowed : AVAILABILITY_FUELS/)
})

test("цена показывается с копейками", () => {
  /* Округление до рубля стирало ровно то, ради чего цену смотрят:
     разница в семьдесят копеек на литр — сорок рублей на бак, и по ней
     человек выбирает между двумя заправками на перекрёстке. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /function formatKopecks/)
  assert.match(page, /maximumFractionDigits: 2/)
  /* Ровные рубли остаются без хвоста: «64 ₽», а не «64,00 ₽». */
  assert.match(page, /Number\.isInteger\(roubles\) \? 0 : 2/)
  /* Старое округление до рубля не должно вернуться. */
  assert.doesNotMatch(page, /Math\.round\(kopecks \/ 100\)/)
  assert.doesNotMatch(page, /\(item\.price \/ 100\)\.toFixed\(0\)/)
})

test("чужую отметку можно подтвердить одним нажатием", () => {
  /* Отметка стареет молча: «есть 92» часовой давности выглядит так же
     уверенно, как пятиминутная. Просить заполнять форму заново ради
     того же ответа бессмысленно. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /Это всё ещё актуально/)
  assert.match(reporter, /confirmCurrent/)
  /* Подтверждать нечего, пока отметка свежая: иначе человек накручивает
     уверенность вместо того, чтобы её проверять. */
  assert.match(reporter, /CONFIRM_AFTER_MS/)
})

test("приближение карты не сбрасывается при подгрузке участка", () => {
  /* Человек приближал карту, сдвиг подгружал новый участок, сервер
     отвечал уточнённым центром — и масштаб откатывался к обзорному.
     Со стороны это выглядело так, будто нажатие на заправку отменяет
     приближение. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  /* Сброс привязан к названию места, а не к координатам: они меняются
     при каждой подгрузке. */
  assert.match(page, /const areaKey = city/)
  assert.match(page, /\}, \[areaKey\]\)/)
})

test("город запоминается и определяется по местоположению", () => {
  /* Человек из Уфы открывал карту, видел Москву и менял город руками —
     каждый раз, после каждого захода. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /CITY_STORAGE_KEY/)
  assert.match(page, /findNearestCity/)
  assert.match(page, /getCurrentPosition/)
  /* Определение не спорит с выбором человека: если он уже выбирал
     город, координаты его не переопределяют. */
  assert.match(page, /hasLocatedRef/)

  const cities = readFileSync(new URL("../src/lib/cities.ts", import.meta.url), "utf8")
  assert.match(cities, /export function findNearestCity/)
})

test("карта увеличивается щипком двумя пальцами", () => {
  /* Код видел только один указатель: второй палец не существовал для
     карты вовсе, и щипковое увеличение — то, чем на телефоне
     пользуются в первую очередь, — просто не работало. Оставались
     кнопки «плюс-минус» в углу, до которых на ходу не дотягиваются. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /activePointers/)
  assert.match(page, /pinchState/)
  /* Масштаб карты удваивается на каждом шаге, поэтому расстояние между
     пальцами переводится в шаги логарифмом по основанию два. */
  assert.match(page, /Math\.log2\(distance \/ pinch\.startDistance\)/)
})

test("страница карты не кэшируется на год", () => {
  /* Next пререндерил её статической и отдавал с s-maxage=31536000. В
     разметке лежит ссылка на сборку кода, и после каждого выката
     человек с телефона открывал старую версию, пока не чистил браузер
     вручную. */
  const layout = readFileSync(new URL("../src/app/services/fuel-map/layout.tsx", import.meta.url), "utf8")
  assert.match(layout, /export const dynamic = "force-dynamic"/)
})

test("группа заправок красится цветом преобладающей сети", () => {
  /* Группа была серым кружком с числом: «5 АЗС» не говорило, чьи это
     заправки, и человек приближал карту только чтобы узнать, есть ли
     среди них его сеть. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /clusterNetwork/)
  /* Но только когда сеть действительно преобладает: в пёстрой группе
     фирменный цвет соврал бы про её состав. */
  assert.match(page, /best\.count >= Math\.ceil\(marker\.stations\.length \/ 2\)/)
  /* И только когда наличие неизвестно: оно важнее принадлежности. */
  assert.match(page, /clusterNetwork && clusterState === "unknown"/)
})

test("подписка и «поделиться» стоят ниже вкладок", () => {
  /* Они отодвигали вниз то, ради чего карточку открывают: отметку,
     цены и комментарии. На телефоне это стоило экрана прокрутки. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  const tabsAt = page.indexOf("fuel-card-tabs")
  const subscribeAt = page.indexOf("<FuelSubscribeButton")
  assert.ok(tabsAt > 0 && subscribeAt > tabsAt, "кнопки должны стоять ниже вкладок")
})

test("знак сети виден на фирменной плашке", () => {
  /* Подложка делалась из цвета текста с прозрачностью, и на синей
     Башнефти получался почти невидимый белый на синем: буквы
     пропадали, а плашка выглядела безымянной. Белый кружок читается на
     любом фирменном цвете. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const rule = css.slice(css.indexOf('.fuel-map-plate[data-branded] .fuel-map-plate__logo'))
  assert.match(rule.slice(0, 320), /background: #fff/)
  assert.match(rule.slice(0, 320), /color: var\(--plate-brand\)/)
})

test("марка топлива на плашке обведена рамкой", () => {
  /* Подряд идущие «92 95 98 ДТ» сливались в строку, и человек читал их
     как один номер — особенно когда под маркой стояла цена. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const rule = css.slice(css.indexOf('.fuel-map-plate__fuel {'))
  assert.match(rule.slice(0, 260), /border: 1px solid/)
  assert.match(rule.slice(0, 260), /border-radius/)
})

test("статус заправки читается строкой, а не только значками", () => {
  /* Марки бейджами отвечали «что есть», но не отвечали «ехать или
     нет»: человек читал шесть значков и сам сводил их в вывод. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /fuel-status/)
  assert.match(page, /Топливо есть/)
  assert.match(page, /Топлива нет/)
  /* Уверенность стоит рядом со статусом: в отрыве от него она
     бесполезна. */
  assert.match(page, /fuel-status__confidence/)
})

test("сетка марок не дублирует бейджи карточки", () => {
  /* «92 · 63,20 ₽» зелёным в карточке и «92 / есть / 14 мин назад» в
     форме — одно и то же двумя способами, на два экрана прокрутки. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.doesNotMatch(reporter, /className="fuel-report__status"/)
})

test("сеть узнаётся по буквам на фирменном цвете", () => {
  /* Рисованные знаки сетей узнавались хуже настоящих логотипов и
     занимали место на плашке. Буквы на фирменном цвете читаются
     мгновенно и не притворяются товарным знаком. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /plateIdentity\.shortLabel/)
  assert.doesNotMatch(page, /brand\/fuel\//)
})

test("плитка марки показывает цену и свежесть", () => {
  /* Бейдж «92 · 63,20 ₽» отвечал на два вопроса из трёх: видно, что
     есть и почём, но не видно, когда отметили. Возраст стоял одной
     строкой на всю карточку, хотя у каждой марки он свой. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /fuel-tile__price/)
  assert.match(page, /fuel-tile__age/)
})

test("уверенность показана шкалой, а не только числом", () => {
  /* Процент числом человек читает, но не чувствует: «44%» и «68%»
     выглядят одинаково, пока не сравнишь их между собой. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /fuel-status__meter/)
  assert.match(page, /confidenceNote/)
})

test("газ не показывается на бензиновой заправке даже после отметки", () => {
  /* Марка оставалась, если её кто-то когда-то отмечал, — и на
     бензиновой Башнефти висел газ только потому, что кто-то однажды
     нажал по нему «нет». */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  const narrowed = reporter.slice(reporter.indexOf("const narrowed"), reporter.indexOf("return narrowed.length"))
  /* Проверка по тегу идёт раньше проверки по отметкам. */
  assert.ok(
    narrowed.indexOf('fuel === "GAS"') < narrowed.indexOf('!== "UNKNOWN"'),
    "ассортимент должен решать раньше прошлых отметок",
  )
})

test("карта АЗС есть в главном меню", () => {
  /* Она лежала третьим пунктом внутри «Сервисов» — до неё доходили
     двумя нажатиями, зная, что искать, тогда как в дефицит это самый
     нужный инструмент на сайте. */
  const nav = readFileSync(new URL("../src/lib/navigation-registry.ts", import.meta.url), "utf8")
  const primary = nav.slice(nav.indexOf("PRIMARY_NAVIGATION"), nav.indexOf("PLATFORM_NAVIGATION"))
  assert.match(primary, /services\/fuel-map/)
  /* Название про задачу человека, а не про устройство раздела. */
  assert.match(primary, /Где заправиться/)
})

test("плашка без данных зовёт отметить, а не молчит", () => {
  /* Из ста пятидесяти шести точек города у сорока одной в OSM не
     указаны марки топлива — это небольшие частные АЗС, которые никто
     не размечал. Их плашка выходила пустой, будто карта сломалась. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /needsFirstReport/)
  assert.match(page, /Отметьте, что здесь есть/)
})

test("закрытую заправку можно отметить отдельно от пустых колонок", () => {
  /* Для человека за рулём это разное: у пустых колонок можно дождаться
     подвоза, к запертым воротам ехать бессмысленно вовсе. */
  const reporter = readFileSync(new URL("../src/components/fuel/FuelAvailabilityReporter.tsx", import.meta.url), "utf8")
  assert.match(reporter, /markClosed/)
  assert.match(reporter, /Заправка не работает/)
  /* Отдельного состояния в базе нет: закрытая заправка — это «нет
     всего» с пояснением, которое уходит комментарием. */
  assert.match(reporter, /CLOSED_NOTE/)
  /* Одно состояние снимает другое: пустые колонки и запертые ворота не
     могут быть отмечены одновременно. */
  assert.match(reporter, /if \(isClosed\) setComment\(""\)/)
})

test("шапка не переполняется на ноутбуке", () => {
  /* Пунктов стало шесть, а рядом «Сервисы», «Стать партнёром», поиск и
     четыре иконки кабинета: ряд переставал помещаться, вкладки
     наезжали на кнопки, колокольчик уходил за край. */
  const header = readFileSync(new URL("../src/components/layout/AppHeader.tsx", import.meta.url), "utf8")
  assert.match(header, /SECONDARY_HEADER_TABS/)
  /* Открытый раздел не прячется: человек должен видеть, где он. */
  assert.match(header, /&& !item\.active \? " market-header-tab--secondary"/)

  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  assert.match(css, /@media \(max-width: 1400px\) \{\s*\.market-header-tab--secondary \{\s*display: none/)
})

test("ассортимент виден до того, как кто-то отметил наличие", () => {
  /* В карточке стояла одна строка «Здесь ещё не отмечали наличие», и
     человек не видел, какие колонки на станции вообще есть. Чтобы это
     узнать, надо было открыть форму отметки: сведения из OSM лежали в
     карточке, но показывались только тому, кто уже решил отмечать. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /На станции есть колонки/)

  /* Состояние плитки вычисляется, а не проставляется литералом: когда
     источник знает наличие по маркам, плитка красится зелёной или
     красной, и только при его молчании остаётся серой. */
  assert.match(page, /sourceKnowsAvailability \? "unknown"/)
  assert.match(page, /sourceFuelsNow/)

  /* Серый цвет честно молчит про наличие: зелёный или красный здесь
     соврали бы. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  assert.match(css, /\.fuel-tile\[data-state="unknown"\]/)
})

test("крупные сети России узнаются на карте", () => {
  /* Замер по семи городам: у ТАИФ-НК шестьдесят шесть точек, у ПРАЙМ
     восемнадцать, у Воронежской топливной семнадцать — все они висели
     серыми, будто безымянные заправки. */
  for (const [name, label] of [
    ["ТАИФ-НК", "ТАИФ-НК"],
    ["ПРАЙМ", "ПРАЙМ"],
    ["Воронежская топливная компания", "ВТК"],
    ["ТНК", "ТНК"],
    ["Эверон", "Эверон"],
  ]) {
    assert.equal(getStationIdentity({ name, fuels: ["АИ-95"] }).label, label, `сеть не распознаётся: ${name}`)
  }
  /* Газовые сети отдельной палитрой: человек с газобаллонным
     оборудованием ищет именно их. */
  assert.equal(getStationIdentity({ name: "ЭКОГАЗ", fuels: [] }).label, "Газовая АЗС")
})

test("точки не пропадают, пока грузится новый участок", () => {
  /* Адрес запроса меняется при сдвиге карты, и без keepPreviousData
     SWR отбрасывал прошлый ответ: на две-три секунды карта пустела
     совсем. Со стороны это выглядело как поломка — человек приближал
     карту и терял всё, что видел. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  /* Три запроса: точки, цены и отметки — мигал каждый по-своему. */
  assert.equal((page.match(/keepPreviousData: true/g) || []).length, 3)
})

test("группа показывает состав по сетям, а не только преобладающую", () => {
  /* Один цвет говорил про преобладающую сеть, а в группе из восьми
     заправок их обычно три-четыре: было не видно, есть ли среди них
     своя, пока не приблизишь карту. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /clusterRing/)
  assert.match(page, /conic-gradient/)
  /* Одна сеть на группу — кольцо не нужно: заливка уже сказала всё. */
  assert.match(page, /if \(shares\.size < 2\) return null/)

  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  /* Число остаётся читаемым: под ним сплошная подложка. */
  assert.match(css, /fuel-map-marker__count/)
})

test("бензиновая сеть не становится газовой из-за названия", () => {
  /* Проверка по названию ловила «Газпромнефть» — обычную бензиновую
     сеть, у которой в имени есть «газ». Замер по сорока трём городам:
     из 1798 точек, попавших в газовые, четыреста с лишним оказались
     Газпромнефтью, и на карте они красились бирюзовым как АГЗС.
     Человек с газобаллонным оборудованием поехал бы туда зря. */
  /* Решает ассортимент: бензин в колонках — заправка бензиновая, чем
     бы её ни назвали. */
  assert.equal(getStationIdentity({ name: "Газпромнефть", fuels: ["АИ-95", "ДТ"] }).label, "Газпромнефть")
  assert.equal(getStationIdentity({ name: "Заправка", fuels: ["LPG"] }).label, "Газовая АЗС")

  /* Название учитывается только там, где ассортимент пуст, и по
     полному слову: «газ» внутри «Газпромнефти» ничего не значит. */
  assert.equal(getStationIdentity({ name: "Газпромнефть", fuels: [] }).label, "Газпромнефть")
  assert.equal(getStationIdentity({ name: "АГЗС у трассы", fuels: [] }).label, "Газовая АЗС")
})

test("карту можно тянуть пальцем с любого места, включая метки", () => {
  /* Метки гасили нажатие, и карту нельзя было потянуть, положив палец
     на плашку — а их на экране десятки. Человек тянул, карта стояла, а
     страница уезжала вниз, будто окно сворачивается. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.doesNotMatch(page, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/)
  /* Перетаскивание при этом не открывает карточку: иначе движение,
     начатое с метки, всплывало бы панелью поверх карты.

     Проверка идёт по ref, а не по состоянию React: клик приходит в том
     же цикле событий, что и отпускание кнопки, и состояние к этому
     моменту ещё старое. Мышью это ломало открытие карточки почти
     всегда — курсор между нажатием и отпусканием смещается на
     несколько пикселей. */
  assert.match(page, /if \(isDraggingRef\.current\) return/)
  assert.match(page, /isDraggingRef\.current = true/)

  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  /* Жест внутри карты принадлежит карте, где бы палец ни лёг. */
  assert.match(css, /\.fuel-map-canvas \*,/)
  /* Карточка точки — исключение: её содержимое надо прокручивать. */
  assert.match(css, /\.fuel-map-selected \*\s*\{\s*touch-action: auto/)
})

test("выбранный город не перебивается геолокацией", () => {
  /* Ответ браузера о местоположении приходит через секунды, и за это
     время человек успевает выбрать город сам. Проверка шла один раз при
     загрузке: выбрал Уфу, пришёл ответ — карта молча возвращалась в
     Челябинск, а в поле оставалась «Уфа». */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /chosenCityRef\.current = true/)
  const applyPoint = page.slice(page.indexOf("const applyPoint"), page.indexOf("navigator.geolocation.getCurrentPosition"))
  assert.match(applyPoint, /if \(chosenCityRef\.current\) return/)
})

test("найденное место открывается на карте", () => {
  /* Поиск задавал только запрос к серверу: точки приезжали новые, а
     карта оставалась там, где стояла. Человек искал «Уфа», нажимал ввод
     и продолжал смотреть на Челябинск. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /placeCoordinatesKey/)
  assert.match(page, /setViewportCoordinates\(data\.coordinates\)/)
})

test("мышью карту тянут без выделения текста", () => {
  /* touch-action решает только жесты пальцем. На десктопе, начав тянуть
     с плашки заправки, человек попадал не в панораму, а в выделение
     текста: браузер подсвечивал «Башнефть ДТ АИ-92», карта стояла. */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const rule = css.slice(css.indexOf("Мышью карту тоже нужно тянуть"), css.indexOf("Карточка точки — исключение: в ней адрес"))
  assert.match(rule, /user-select: none/)
  assert.match(rule, /-webkit-user-drag: none/)
})

test("захват указателя ставится только при перетаскивании", () => {
  /* Захват перенаправляет карте все события указателя — и клик в том
     числе: браузер отдаёт его элементу с захватом, а не плашке
     заправки, по которой нажали. Нажатие доходило до карты и умирало
     там, карточка не открывалась.

     Захват нужен только чтобы карта не «отцеплялась», когда курсор ушёл
     за её край, — значит и ставить его надо тогда, когда перетаскивание
     действительно началось. */
  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  const down = page.slice(page.indexOf("const handlePointerDown"), page.indexOf("const handlePointerMove"))
  const move = page.slice(page.indexOf("const handlePointerMove"), page.indexOf("const handlePointerEnd"))

  /* В обработчике нажатия захват допустим только внутри ветки щипка:
     двумя пальцами по метке не нажимают. */
  const beforePinch = down.slice(0, down.indexOf("activePointers.current.size === 2"))
  assert.doesNotMatch(beforePinch, /setPointerCapture/)
  assert.match(move, /setPointerCapture/)
})

test("карта показывает, что сервисом пользуются", () => {
  /* Точки из справочника выглядят одинаково, и новичок думает, что он
     тут первый: открыл карту, увидел серые метки, ушёл не отметив.
     Между тем отметки есть — десятки за неделю.

     Цифра отвечает на это прямо, своими данными: чужие цены с других
     сервисов подорвали бы единственное, ради чего сюда приходят, —
     уверенность, что здесь написана правда. */
  const route = readFileSync(new URL("../src/app/api/fuel-availability/route.ts", import.meta.url), "utf8")
  assert.match(route, /reportsToday/)
  /* Считаем по всей площадке, а не по видимому участку: человек в
     Челябинске должен видеть, что сервисом пользуются, даже если в его
     квартале сегодня тихо. */
  assert.match(route, /fuelAvailabilityReport\.count/)

  const page = readFileSync(new URL("../src/app/services/fuel-map/page.tsx", import.meta.url), "utf8")
  assert.match(page, /fuel-map-canvas__activity/)
  /* Ноль отметок не показываем: «0 отметок за сутки» говорит ровно
     обратное тому, зачем эта плашка. */
  assert.match(page, /reportsToday > 0/)
})

test("прайс сети не приписывает станции топливо, которого на ней нет", () => {
  /* На Башнефти появлялся газ по 43,97: ГдеЗаправка отдаёт средний прайс
     сети по региону сразу на все марки, а скрейпер приписывал его каждой
     точке целиком. Из сорока тысяч собранных цен тридцать пять тысяч
     пришли так, без единого подтверждения, и человек ехал за топливом,
     которого на этой колонке не бывает.

     Ассортимент берётся из fuel_types (колонки станции), а не из
     available_fuels (что подтвердили только что — обычно пусто). Спутать
     их значит либо оставить станцию без цен, либо снова приписать чужие. */
  const scraper = readFileSync(new URL("../src/lib/gdezapravka-scraper.ts", import.meta.url), "utf8")

  assert.match(scraper, /const stationFuelCodes = Array\.isArray\(raw\.fuel_types\)/)
  assert.doesNotMatch(scraper, /const mergedPrices = \{ \.\.\.brandPrices, \.\.\.ownPrices \}/)
  assert.match(scraper, /if \(stationFuelCodes && !stationFuelCodes\.has\(fuelCode\)\) return \[\]/)

  /* Газ бывает на АГЗС, а не на бензиновой колонке, и ошибка тут дороже
     прочих: водитель на газу приедет туда, где заправиться нечем. У всех
     десяти нормальных Башнефтей Уфы ассортимент заполнен и газа в нём
     нет — газ вылезал на единственной точке с пустым fuel_types. */
  assert.match(scraper, /if \(!stationFuelCodes && fuel === "GAS"\) return \[\]/)
})

test("одна заправка из двух источников показывается одной точкой", () => {
  /* ГдеБЕНЗ и ГдеЗаправка собирают одни и те же заправки, и в базе они
     лежат отдельными записями — это правильно, у каждого источника своя
     частота обновления и свои пробелы. Но на карту они выходили двумя
     метками: из четырёхсот трёх точек Уфы сто шестьдесят пять оказались
     дублями. Человек видел два «Irbis» в одном дворе, где у одного есть
     АИ-95, а у другого нет, и не понимал, какому верить.

     Склейка объединяет знание, а не выбирает победителя: марка, которую
     знает хоть один источник, остаётся; при споре о цене побеждает более
     свежая отметка. */
  const route = readFileSync(new URL("../src/app/api/fuel-stations/route.ts", import.meta.url), "utf8")

  assert.match(route, /function mergeProviderStations/)
  assert.match(route, /mergeStations\(mergeProviderStations\(/)

  /* Пустое поле одного источника не должно стирать данные другого. */
  assert.match(route, /fuelsNow: twin\.fuelsNow\?\.length \? twin\.fuelsNow : station\.fuelsNow/)
  assert.match(route, /status: twin\.status !== "UNKNOWN" \? twin\.status : station\.status/)
})

test("лента прогонов не съедает хранилище", () => {
  /* Лента доросла до 80 тысяч строк и 23 МБ — против 4 МБ самих заправок
     с ценами, ради которых всё и собирается: при сборе каждые 15 минут
     каждый прогон пишет строку на каждую заправку. Хранилище съедала
     отладочная информация, а не данные.

     Потолок задан и в прогонах, и в строках: один прогон может оказаться
     огромным, и счёта прогонов тогда не хватит. */
  const store = readFileSync(new URL("../src/lib/fuel-import-store.ts", import.meta.url), "utf8")

  assert.match(store, /const KEEP_LOG_ENTRIES = /)
  assert.match(store, /const total = await prisma\.fuelImportLogEntry\.count\(\)/)
})

test("газовая заправка узнаётся по названию, но Газпромнефть не путается с АГЗС", () => {
  /* У сорока четырёх точек Уфы ассортимент в источнике пуст, а название
     прямо говорит про газ: «ПетролГаз», «MGaz», «АГЗС». Плашка выходила
     пустой — ни марки, ни цены, будто карта сломалась.

     Слово бывает склеено с названием, поэтому проверки по отдельному
     слову мало. Но расширять её можно только с защитой: у Газпромнефти в
     имени тоже есть «газ», а заправка бензиновая — водитель на ГБО
     приехал бы туда зря. */
  const identity = readFileSync(new URL("../src/lib/fuel-station-identity.ts", import.meta.url), "utf8")

  /* Ловится тип станции, а не слово «газ» в имени сети: проверка на одну
     основу записала в газовые обычный «Газпром» без ассортимента. */
  assert.match(identity, /агзс\|агнкс\|автогаз\|газомотор\|трансгаз\|сжиженн\|пропан\|метан/)
  assert.doesNotMatch(identity, /\/\(газ\|gaz\|пропан\|метан\)\//)

  /* Правило работает только при пустом ассортименте: у Газпромнефти он
     заполнен бензином, и до проверки имени дело не доходит. */
  assert.match(identity, /const namedGasOnly = !fuels/)

  const route = readFileSync(new URL("../src/app/api/fuel-stations/route.ts", import.meta.url), "utf8")
  assert.match(route, /looksGas \? \["Газ"\] : known/)
  assert.match(route, /агзс\|агнкс\|автогаз\|газомотор/)
})

test("заправка забирает все свои двойники из OpenStreetMap, а не первого", () => {
  /* Заправка бывает нанесена в OSM не один раз: колонки отдельной точкой,
     здание контуром, навес ещё одним. Забрав только первого двойника,
     карта оставляла остальных отдельными метками — в Казани рядом стояли
     две «Татнефти», и больше половины тамошних дублей были такими. */
  const route = readFileSync(new URL("../src/app/api/fuel-stations/route.ts", import.meta.url), "utf8")

  assert.match(route, /for \(let index = unmatchedDirectoryStations\.length - 1; index >= 0; index -= 1\)/)
})

test("скрейпер бережёт соединения прокси", () => {
  /* Провайдер даёт пятьдесят TCP на клиента, и упёршись в потолок прокси
     перестаёт работать, пока соединения не сброшены. Короткие повторы
     только держат счётчик занятым: скрейпер долбится, лимит не
     освобождается, прогон идёт вхолостую. */
  const http = readFileSync(new URL("../src/lib/fuel-scraper-http.ts", import.meta.url), "utf8")

  /* Пять минут дают провайдеру закрыть повисшие сокеты по таймауту. */
  assert.match(http, /const CONNECTION_LIMIT_PAUSE_MS = 5 \* 60_000/)
  assert.match(http, /function isConnectionLimitError/)

  /* Пул пересоздаётся: агенты держат сокеты, которые провайдер уже считает
     мёртвыми, и повтор на том же агенте упрётся в них снова. */
  assert.match(http, /export function resetProxyPool/)
  assert.match(http, /resetProxyPool\(\)/)

  /* Соединение закрывается сразу после ответа, а не держится до обрыва на
     перезагрузке прокси: до обрыва оно числится занятым у провайдера. */
  assert.match(http, /Connection: "close"/)

  /* Медиа не выкачивается: скрейперу нужны JSON и HTML, а картинка занимает
     соединение без всякой пользы. */
  assert.match(http, /\^\(image\|video\|audio\|font\)/)
  assert.doesNotMatch(http, /Accept: "application\/json,text\/plain,\*/)

  /* Сжатие освобождает сокет раньше: 171 КБ выдачи едут как 15 КБ. */
  assert.match(http, /"Accept-Encoding": "gzip, deflate"/)
  assert.match(http, /zlib\.gunzipSync/)
})

test("оператор из OpenStreetMap не подменяет вывеску заправки", () => {
  /* Оператор в OSM — юрлицо, а не то, что написано на заправке: у
     «Стифкора» там «СигмаГаз», у «Irbis» — «ТранзитСити». Сравнивая
     операторов с именами, карта не узнавала свою же точку из другого
     источника: четыре заправки Казани стояли двумя метками в нуле метров
     друг от друга, и у OSM-копии не было цен.

     Оператор остаётся последним запасом — у безымянной точки он лучше
     пустоты, — но идёт после вывески и имени. */
  const route = readFileSync(new URL("../src/app/api/fuel-stations/route.ts", import.meta.url), "utf8")

  assert.match(route, /\[station\.brand, station\.name, station\.operator\]\.find\(isMeaningfulStationName\)/)
})
