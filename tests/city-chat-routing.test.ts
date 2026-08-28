import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { FALLBACK_CHAT_TITLE, listRoutedChatTitles, pickChatTitleForCity } from "../src/lib/city-chat-routing.ts"

test("город объявления ведёт в чат своего города", () => {
  assert.equal(pickChatTitleForCity("Казань"), "Авторынок Казань")
  assert.equal(pickChatTitleForCity("Москва"), "Авторынок Москва")
  assert.equal(pickChatTitleForCity("Екатеринбург"), "Авторынок Екатеринбург")
  assert.equal(pickChatTitleForCity("Уфа"), "АВТОРЫНОК УФА/Башкортостан")
})

test("города Башкирии идут в чат Уфы, а не в общий", () => {
  // Октябрьский и Гафурийский район — Башкирия. Своих чатов у них нет, а
  // покупатель оттуда едет в Уфу, а не по всей стране.
  assert.equal(pickChatTitleForCity("Октябрьский"), "АВТОРЫНОК УФА/Башкортостан")
  assert.equal(
    pickChatTitleForCity("Гафурийский район село красноусольск"),
    "АВТОРЫНОК УФА/Башкортостан",
  )
})

test("города Татарстана идут в чат Казани", () => {
  assert.equal(pickChatTitleForCity("Набережные Челны"), "Авторынок Казань")
  assert.equal(pickChatTitleForCity("Альметьевск, Казань"), "Авторынок Казань")
})

test("регистр и «ё» не мешают разбору", () => {
  // Поле города человек заполняет руками: «йошкар ола» с малой буквы —
  // настоящая запись из базы, а «Королёв» половина пишет через «е».
  assert.equal(pickChatTitleForCity("МОСКВА"), "Авторынок Москва")
  assert.equal(pickChatTitleForCity("королёв"), "Авторынок Москва")
  assert.equal(pickChatTitleForCity("Королев"), "Авторынок Москва")
})

test("неизвестный город уходит в общий чат страны", () => {
  // Чата под Марий Эл нет, но машина продаётся: показать всей стране
  // лучше, чем не показать никому.
  assert.equal(pickChatTitleForCity("йошкар ола"), FALLBACK_CHAT_TITLE)
  assert.equal(pickChatTitleForCity("Владивосток"), FALLBACK_CHAT_TITLE)
})

test("пустой город не роняет разбор", () => {
  assert.equal(pickChatTitleForCity(null), FALLBACK_CHAT_TITLE)
  assert.equal(pickChatTitleForCity(undefined), FALLBACK_CHAT_TITLE)
  assert.equal(pickChatTitleForCity("   "), FALLBACK_CHAT_TITLE)
})

test("все названия из правил совпадают с чатами сети", () => {
  // Опечатка в названии означала бы, что чат не найдётся и объявление
  // молча уйдёт в общий чат вместо своего города.
  const real = [
    "АВТОРЫНОК УФА/Башкортостан",
    "Авторынок Екатеринбург",
    "Авторынок Казань",
    "Авторынок Москва",
    "Авторынок Оренбург",
    "Авторынок России",
    "Авторынок Самара",
    "Авторынок Сочи",
    "Авторынок Сургут",
    "Авторынок Тюмень",
    "Авторынок Челябинск",
  ]
  for (const title of listRoutedChatTitles()) {
    assert.ok(real.includes(title), `нет такого чата: ${title}`)
  }
})
