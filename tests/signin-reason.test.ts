import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { signInReason } from "../src/lib/signin-reason.ts"

test("без адреса возврата остаётся общий заголовок", () => {
  assert.equal(signInReason(null).title, "Вход в аккаунт")
  assert.equal(signInReason("").title, "Вход в аккаунт")
  assert.equal(signInReason(undefined).title, "Вход в аккаунт")
})

test("подача объявления сообщает о бесплатности", () => {
  // «Размещение бесплатно» стояло единственный раз на весь сайт — на
  // странице в подвале, до которой шесть экранов прокрутки.
  const reason = signInReason("/listings/create/quick")
  assert.match(reason.title, /разместить объявление/i)
  assert.match(reason.hint, /бесплатн/i)
})

test("продвижение отличается от подачи", () => {
  // Оба пути начинаются с /listings — правило продвижения должно
  // сработать раньше общего правила объявления.
  const reason = signInReason("/listings/abc123/promote")
  assert.match(reason.title, /продвинуть/i)
})

test("кнопка телефона объясняет, зачем нужен вход", () => {
  const reason = signInReason("/listings/vehicle/abc123")
  assert.match(reason.title, /связаться с продавцом/i)
  assert.match(reason.hint, /телефон/i)
})

test("заявка на лот говорит о партнёре", () => {
  const reason = signInReason("/auctions/da053a88-1111")
  assert.match(reason.title, /заявку/i)
})

test("страница списка аукционов входа не требует и общего правила не ломает", () => {
  // /auctions без второго сегмента — открытый список, вход туда не ведёт.
  assert.equal(signInReason("/auctions").title, "Вход в аккаунт")
})

test("адрес приходит закодированным", () => {
  // Именно в таком виде его ставит кнопка: encodeURIComponent от пути.
  const encoded = encodeURIComponent("/auctions/da053a88#order")
  assert.match(signInReason(encoded).title, /заявку/i)
})

test("полный адрес своего сайта разбирается по пути", () => {
  assert.match(signInReason("https://lewheel.ru/favorites").title, /избранное/i)
})

test("чужой домен не получает своей подписи", () => {
  // Подставленный извне адрес не должен управлять текстом страницы входа.
  assert.equal(signInReason("https://example.com/listings/create/quick").title, "Вход, чтобы разместить объявление")
})

test("испорченный адрес не роняет страницу", () => {
  assert.equal(signInReason("%%%").title, "Вход в аккаунт")
  assert.equal(signInReason("не адрес вовсе").title, "Вход в аккаунт")
})

test("личный кабинет и сделки различаются", () => {
  assert.match(signInReason("/dashboard/deliveries").title, /сделок/i)
  assert.match(signInReason("/dashboard").title, /личный кабинет/i)
})
