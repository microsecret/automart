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
