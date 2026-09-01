import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildFuelInvitePost, buildFuelShareText, cityFromChatTitle } from "../src/lib/fuel-invite-post.ts"

const base = { siteUrl: "https://lewheel.ru/", botUsername: "lewheelbot" }

test("первая строка говорит о пользе, а не о нас", () => {
  /* Человек читает чат по диагонали: если первая строка про компанию, он
     листает дальше. */
  const post = buildFuelInvitePost(base)
  const first = post.text.split("\n")[0]
  assert.match(first, /бензин/i)
  assert.doesNotMatch(first, /LeWheel|мы |наш/i)
})

test("город чата подставляется в текст", () => {
  /* «Карта АЗС Казани» человек примеряет на себя, «карта АЗС России»
     нет. */
  const post = buildFuelInvitePost({ ...base, city: "Казань" })
  assert.ok(post.text.includes("Казани") || post.text.includes("Казань"))
})

test("без города текст остаётся связным", () => {
  // Общий чат страны читают из разных городов.
  const post = buildFuelInvitePost(base)
  assert.ok(post.text.includes("карту АЗС"))
  assert.doesNotMatch(post.text, /undefined|null/)
})

test("маленькое число отметок не называется", () => {
  /* «Уже 4 отметки» отпугивает сильнее, чем молчание: человек видит
     пустой сервис и не возвращается. */
  const post = buildFuelInvitePost({ ...base, reportsCount: 4 })
  assert.doesNotMatch(post.text, /Уже 4/)
})

test("большое число отметок называется", () => {
  const post = buildFuelInvitePost({ ...base, reportsCount: 1240 })
  // Разряды toLocaleString разделяет неразрывным пробелом (код 160).
  assert.ok(/1.240/.test(post.text), post.text.slice(0, 200))
})

test("просьба переслать стоит в конце", () => {
  /* Просить раньше значит просить у того, кто ещё не понял за что. */
  const post = buildFuelInvitePost(base)
  const askAt = post.text.indexOf("Перешлите")
  const useAt = post.text.indexOf("Что умеет")
  assert.ok(askAt > useAt, "просьба должна идти после пользы")
})

test("в тексте есть про взаимопомощь, а не только про сервис", () => {
  // Карта держится на том, что люди помогают друг другу.
  const post = buildFuelInvitePost(base)
  assert.match(post.text, /Помогаем друг другу|чем больше нас/i)
})

test("первая кнопка ведёт на карту", () => {
  // Смотреть карту можно без бота и без входа — это самый низкий порог.
  const post = buildFuelInvitePost(base)
  assert.match(post.buttons[0].url, /\/services\/fuel-map/)
})

test("без имени бота остаётся только карта", () => {
  const post = buildFuelInvitePost({ siteUrl: "https://lewheel.ru/" })
  /* Карта и пересылка: вторая работает без бота, потому что ведёт на
     сайт — пост живёт в городском чате, и переслать его должно быть
     можно всем. */
  assert.equal(post.buttons.length, 2)
  assert.ok(post.buttons[1].url.includes("t.me/share/url"))
})

test("подпись укладывается в предел Telegram", () => {
  /* Подпись под фотографией ограничена 1024 знаками: длиннее пост уйдёт
     обрезанным на полуслове. */
  const post = buildFuelInvitePost({ ...base, city: "Екатеринбург", reportsCount: 12345 })
  assert.ok(post.text.length <= 1024, `получилось ${post.text.length}`)
})

test("короткий текст для пересылки — действительно короткий", () => {
  /* Длинный пост в личной переписке читается как реклама, которую
     переслали не глядя. */
  const text = buildFuelShareText({ siteUrl: "https://lewheel.ru/", city: "Уфа" })
  assert.ok(text.length < 300, `получилось ${text.length}`)
  assert.match(text, /lewheel\.ru/)
})

test("город достаётся из названия чата", () => {
  assert.equal(cityFromChatTitle("Авторынок Казань"), "Казань")
  assert.equal(cityFromChatTitle("АВТОРЫНОК УФА/Башкортостан"), "Уфа")
  assert.equal(cityFromChatTitle("Авторынок Екатеринбург"), "Екатеринбург")
})

test("у общего чата страны города нет", () => {
  // Его читают из разных городов, и «карта АЗС России» звучит пусто.
  assert.equal(cityFromChatTitle("Авторынок России"), null)
  assert.equal(cityFromChatTitle(null), null)
})

test("чат зовут раз в шесть часов, и частота настраивается", () => {
  /* Было трое суток — из осторожности. Но сервис карты держится на числе
     людей, а за трое суток пост уходил в глубину переписки и его не видел
     никто, кроме тех, кто был в чате в ту минуту.

     Шесть часов — четыре захода в сутки: утро, день, вечер и ночь. Нужный
     темп виден только по реакции чатов, поэтому частота меняется из env,
     без правки кода. */
  const broadcast = readFileSync(new URL("../src/lib/fuel-invite-broadcast.ts", import.meta.url), "utf8")

  assert.match(broadcast, /DEFAULT_CHAT_INTERVAL_MS = 6 \* 60 \* 60 \* 1000/)
  assert.match(broadcast, /FUEL_INVITE_INTERVAL_HOURS/)

  /* Не чаще часа: при более частом повторе бота первым выкинет админ
     чата, а не Telegram. */
  assert.match(broadcast, /Math\.max\(1, configured\)/)
})

test("обложка приглашения читается с диска, а не по ссылке", () => {
  /* Отправка читает свои снимки с диска и только из /uploads: ссылку на
     наш домен Telegram не берёт — отвечает «failed to get HTTP URL
     content», и пост не уходит вовсе.

     Путь из другой папки молча не сработал бы: картинка не прочиталась бы
     с диска, ушла ссылкой и не дошла. Поэтому чужой путь отклоняется
     сразу, с записью в журнал, и пост уходит текстом — это хуже картинки,
     но лучше молчания. */
  const broadcast = readFileSync(new URL("../src/lib/fuel-invite-broadcast.ts", import.meta.url), "utf8")

  assert.match(broadcast, /configured\.startsWith\("\/uploads\/"\)/)
  assert.match(broadcast, /пост уйдёт текстом/)

  /* Чужой адрес Telegram скачает сам — там ограничение не действует. */
  assert.match(broadcast, /configured\.startsWith\("http"\)\) return configured/)
})
