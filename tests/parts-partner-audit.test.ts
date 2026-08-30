import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

/**
 * Проверки по итогам аудита модуля запчастей и партнёрской программы.
 *
 * Каждый тест закрепляет разрыв сценария, из-за которого человек не мог
 * довести начатое до конца.
 */

test("приглашение по партнёрской ссылке доходит до сервера", () => {
  /* Программа была разорвана посередине: кабинет выдавал ссылку с
     кодом, но параметр `ref` не читал никто, а /api/referral/claim не
     вызывался ни из одного места. Приглашённый регистрировался как
     обычный посетитель, и вознаграждение не начислялось никогда. */
  const claim = readFileSync(new URL("../src/components/referral/ReferralClaim.tsx", import.meta.url), "utf8")
  assert.match(claim, /searchParams\.get\("ref"\)/)
  assert.match(claim, /\/api\/referral\/claim/)
  /* Код ждёт входа: регистрация редко случается сразу, человек сначала
     смотрит объявления. */
  assert.match(claim, /localStorage\.setItem\(REFERRAL_STORAGE_KEY/)
  /* Первая ссылка важнее: иначе чужой код перехватил бы уже
     приведённого человека. */
  assert.match(claim, /if \(window\.localStorage\.getItem\(REFERRAL_STORAGE_KEY\)\) return/)

  const shell = readFileSync(new URL("../src/components/layout/AppShellLayout.tsx", import.meta.url), "utf8")
  assert.match(shell, /<ReferralClaim \/>/)
})

test("продавец добавляет позицию без файла", () => {
  /* Единственным способом наполнить каталог был импорт таблицы:
     продавец с пятью деталями упирался в заблокированную кнопку
     «Отправить на проверку». */
  const route = readFileSync(new URL("../src/app/api/stores/[id]/parts/route.ts", import.meta.url), "utf8")
  assert.match(route, /export async function POST/)
  /* Проверки те же, что при правке: цена и сроки не могут быть
     произвольными. */
  assert.match(route, /Цена должна быть положительным числом/)
  assert.match(route, /от 0 до 365/)
  /* Незаполненное берётся из настроек магазина — как в импорте. */
  assert.match(route, /leadMin \?\? guard\.store\.defaultLeadTimeDaysMin/)

  const panel = readFileSync(new URL("../src/components/store/StoreCatalogPanel.tsx", import.meta.url), "utf8")
  assert.match(panel, /startCreating/)
  assert.match(panel, /isCreating \? "POST" : "PATCH"/)
})

test("покупатель отменяет свой заказ сам", () => {
  /* Проверка пропускала только владельца магазина, и покупатель получал
     «Заказ не найден» на собственный заказ: оставалось звонить и просить
     отменить, а до этого заказ висел в работе. */
  const route = readFileSync(new URL("../src/app/api/part-orders/[id]/route.ts", import.meta.url), "utf8")
  assert.match(route, /const isBuyer = /)
  /* Покупателю доступна только отмена и только до отправки. */
  assert.match(route, /Статус заказа меняет магазин/)
  assert.match(route, /Заказ уже в доставке/)
  /* И только своя: заметку продавца он не трогает. */
  assert.match(route, /Заметку продавца меняет магазин/)

  const page = readFileSync(new URL("../src/app/dashboard/orders/page.tsx", import.meta.url), "utf8")
  assert.match(page, /Отменить заказ/)
  assert.match(page, /cancelOrder/)
})

test("магазин узнаёт об отмене покупателем", () => {
  /* Иначе заказ просто исчезал из работы, и магазин мог собрать посылку
     по отменённой заявке. */
  const notify = readFileSync(new URL("../src/lib/part-order-notify.ts", import.meta.url), "utf8")
  assert.match(notify, /export async function notifyStoreOwnerAboutCancellation/)

  const route = readFileSync(new URL("../src/app/api/part-orders/[id]/route.ts", import.meta.url), "utf8")
  /* Кому сообщать, зависит от того, кто менял статус. */
  assert.match(route, /notifyStoreOwnerAboutCancellation\(id, statusReason\)/)
})

test("причина не стирается при обычном переходе статуса", () => {
  /* Стояло `statusReason: ... : null` — и подтверждение заказа затирало
     пояснение, которое продавец написал раньше. */
  const route = readFileSync(new URL("../src/app/api/part-orders/[id]/route.ts", import.meta.url), "utf8")
  assert.match(route, /\.\.\.\(nextStatus === "CANCELLED" \? \{ statusReason \} : \{\}\)/)
  assert.doesNotMatch(route, /statusReason: nextStatus === "CANCELLED" \? statusReason : null/)
})

test("товар магазина открывается из каталога, а не даёт 404", () => {
  /* Товары магазинов создаются импортом прайса и объявлений не
     получают — только запись позиции. Поиск их показывает, а страница
     детали требовала объявление и отвечала «не найдено»: покупатель
     находил деталь в каталоге, нажимал и упирался в пустую страницу.
     Заказать можно было только с витрины магазина, куда ещё надо
     догадаться зайти. */
  const page = readFileSync(new URL("../src/app/listings/part/[id]/page.tsx", import.meta.url), "utf8")
  assert.match(page, /const fromActiveStore = part\.store\?\.status === "ACTIVE"/)
  assert.match(page, /if \(!fromActiveStore && \(!listing \|\| !canPreview\)\) notFound\(\)/)

  /* Приостановленный или черновой магазин по-прежнему закрыт: его
     товары не показываются и в поиске. */
  assert.doesNotMatch(page, /if \(!listing \|\| !canPreview\) notFound\(\)/)
})

test("деталь из магазина можно заказать прямо со страницы", () => {
  /* Открыв товар магазина, покупатель не мог его заказать: кнопки на
     странице не было, заказ жил только на витрине. */
  const client = readFileSync(new URL("../src/app/listings/part/[id]/PartDetailClient.tsx", import.meta.url), "utf8")
  assert.match(client, /import PartOrderButton/)
  assert.match(client, /\{data\.store && \(/)
  /* Условия поставки уходят в форму заказа: покупатель должен видеть
     срок до того, как оставит заявку. */
  assert.match(client, /leadTimeDaysMin=\{data\.leadTimeDaysMin/)
})
