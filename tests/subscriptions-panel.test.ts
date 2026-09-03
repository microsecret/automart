import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

/* Раздела подписок не существовало, хотя подписаться можно было в двух
   местах. Замер на боевом сервере: двести двенадцать пользователей и три
   подписки — человек не видел, на что подписан, и не рисковал
   подписываться дальше.

   Тесты держат связку: пункт меню, вкладка кабинета и обращения к тем
   маршрутам, которые действительно умеют читать и удалять. */

test("подписки доступны из меню кабинета", () => {
  const registry = readFileSync(new URL("../src/lib/navigation-registry.ts", import.meta.url), "utf8")
  assert.match(registry, /id: "subscriptions"/)
  assert.match(registry, /\/dashboard\?tab=subscriptions/)
})

test("вкладка подписок открывается в кабинете", () => {
  const dashboard = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8")
  /* Без этой строки пункт меню вёл бы на страницу, где ничего не
     показывается: вкладка выбрана, а её содержимого нет. */
  assert.match(dashboard, /DASHBOARD_TABS = new Set\(\[[^\]]*"subscriptions"/)
  assert.match(dashboard, /tab === "subscriptions" && <SubscriptionsPanel \/>/)
})

test("панель читает и удаляет подписки теми же маршрутами, что их заводят", () => {
  const panel = readFileSync(new URL("../src/components/dashboard/SubscriptionsPanel.tsx", import.meta.url), "utf8")

  assert.match(panel, /"\/api\/fuel-subscriptions"/)
  assert.match(panel, /"\/api\/saved-searches"/)
  /* Удаление идёт по идентификатору в строке запроса — именно так его
     ждут оба маршрута. */
  assert.match(panel, /\/api\/fuel-subscriptions\?id=/)
  assert.match(panel, /\/api\/saved-searches\?id=/)
  assert.match(panel, /method: "DELETE"/)
})

test("пустой список объясняет, зачем нужна подписка", () => {
  /* Человек попадает сюда из меню, ничего ещё не настроив. Пустой экран
     без объяснения оставил бы его в том же неведении, из-за которого
     подписок и было три на двести двенадцать человек. */
  const panel = readFileSync(new URL("../src/components/dashboard/SubscriptionsPanel.tsx", import.meta.url), "utf8")
  assert.match(panel, /Бот пишет в Telegram/)
  assert.match(panel, /actionHref="\/services\/fuel-map"/)
})
