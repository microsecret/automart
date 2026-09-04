import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { resolveStartRoute, CREATE_VEHICLE_ROUTE } from "../src/lib/telegram-start-route.ts"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { CREATE_VEHICLE_HREF } from "../src/lib/navigation-registry.ts"

test("подписка на заправку возвращает человека к той же точке", () => {
  /* Человек нажал в городском чате «сообщать мне о таком», а войти ещё не
     успел. Раньше после входа он попадал на общую карту города: ни
     заправки из ссылки, ни марки, ни намерения — весь путь до входа
     проделан ради того, чтобы начать заново. */
  const route = resolveStartRoute("start_param=fuelsub_gdebenz_1119699898")

  assert.ok(route)
  assert.ok(route.includes("station=gdebenz-1119699898"))
  assert.ok(route.includes("subscribe=1"))
})

test("идентификаторы с подчёркиванием внутри не ломаются", () => {
  /* Часть источников отдаёт «gdebenz-usr_soJeHhLAT04»: восстанавливается
     только первый разделитель, хвост остаётся как есть. */
  const route = resolveStartRoute("start_param=fuelsub_gdebenz_usr_soJeHhLAT04")

  assert.ok(route)
  assert.ok(route.includes(encodeURIComponent("gdebenz-usr_soJeHhLAT04")))
})

test("чужая строка в параметре никуда не уводит", () => {
  /* Без проверки набора символов параметр стал бы открытым
     перенаправлением внутри приложения. */
  assert.equal(resolveStartRoute("start_param=fuelsub_../../admin"), null)
  assert.equal(resolveStartRoute("start_param=https://evil.example"), null)
  assert.equal(resolveStartRoute("start_param=unknown"), null)
})

test("прежние цели по-прежнему работают", () => {
  assert.ok(resolveStartRoute("start_param=fuel")?.includes("/services/fuel-map"))
  assert.ok(resolveStartRoute("start_param=create")?.includes("source=telegram"))
  assert.ok(resolveStartRoute("start_param=listing_0123456789abcdef")?.includes("/listings/vehicle/"))
})

test("параметр берётся и из адреса страницы", () => {
  /* В браузере мини-приложение открывается обычной ссылкой: там
     start_param приходит в адресе, а не в initData. */
  assert.ok(resolveStartRoute("", "?start=fuel")?.includes("/services/fuel-map"))
})

test("без параметра никуда не уводим", () => {
  assert.equal(resolveStartRoute(""), null)
})

test("адрес размещения объявления не разошёлся с реестром навигации", () => {
  /* Разбор параметра держит адрес у себя, чтобы обойтись без импортов и
     остаться проверяемым. Цена этого — возможность тихого расхождения:
     реестр поменяют, а кнопка «Подать» из бота поведёт в никуда. */
  assert.equal(CREATE_VEHICLE_ROUTE, CREATE_VEHICLE_HREF)
})
