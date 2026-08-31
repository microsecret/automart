/**
 * Сверка неоплаченных заказов продвижения с кассой.
 *
 * Продвижение включается по уведомлению ЮKassa, и это единственная нить,
 * на которой держится заработок площадки. Нить тонкая: адрес уведомлений
 * задаётся руками в кабинете кассы, его легко не указать или сбить при
 * смене домена, а ЮKassa о такой ошибке не сообщает — просто шлёт
 * уведомления в пустоту.
 *
 * Человек тогда платит, деньги списываются, а объявление не
 * продвигается. Он пишет в поддержку и уходит, решив, что его обманули.
 *
 * Скрипт дёргает маршрут приложения: активацией занимается тот же код,
 * что и уведомление — там транзакция, сверка заказа с платежом и разбор
 * случая, когда объявление успело стать неактивным. Второй такой же код
 * разошёлся бы с ним при первой правке.
 */

const baseUrl = process.env.NEXTAUTH_URL || process.env.SITE_URL || "http://127.0.0.1:3000"
const token = process.env.PARSER_TOKEN

if (!token) {
  console.log("Сверка пропущена: PARSER_TOKEN не задан")
  process.exit(0)
}

try {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/payment/reconcile`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    /* Сверка ходит в кассу по каждому заказу: сорок обращений по
       пятнадцать секунд в худшем случае. Берём с запасом. */
    signal: AbortSignal.timeout(10 * 60_000),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    console.error(`Сверка не выполнена: ${response.status}`, payload?.error || "")
    process.exitCode = 1
  } else {
    console.log(
      `Сверка: проверено ${payload?.checked ?? 0}, включено ${payload?.activated ?? 0}, `
      + `отменено ${payload?.failed ?? 0}, ждут оплаты ${payload?.skipped ?? 0}`,
    )
  }
} catch (error) {
  console.error("Сверка не выполнена:", error instanceof Error ? error.message : error)
  process.exitCode = 1
}
