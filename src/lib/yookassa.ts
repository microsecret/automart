/**
 * ЮKassa — приём платежей российскими картами.
 *
 * Продвижение объявлений было построено на Stripe, но Stripe не работает
 * в России с 2022 года: российская карта не проходит, а ключ было негде
 * взять. Кнопка «Продвинуть» возвращала «оплата не подключена» — то
 * есть заработок площадки был равен нулю не из-за спроса, а из-за кассы.
 *
 * ЮKassa выбрана как самая распространённая касса рунета: подключается
 * по ИП или юрлицу, из интеграции нужны только идентификатор магазина и
 * секретный ключ. Зависимостей не добавляем — API обычный HTTP.
 *
 * Важное про безопасность: уведомления ЮKassa не подписаны. Поэтому
 * уведомлению не верим вообще — из него берём только id платежа, а сам
 * платёж перечитываем напрямую из API. Что не подтвердилось запросом к
 * API, того не существует.
 */

const API_BASE = "https://api.yookassa.ru/v3"

export type YookassaConfig = { shopId: string; secretKey: string }

/** Читает настройки кассы; null — касса не подключена. */
export function yookassaConfig(): YookassaConfig | null {
  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  if (!shopId || !secretKey) return null
  return { shopId, secretKey }
}

function authHeader(config: YookassaConfig): string {
  return "Basic " + Buffer.from(`${config.shopId}:${config.secretKey}`).toString("base64")
}

/** Платёж в ответах ЮKassa — только используемые поля. */
export type YookassaPayment = {
  id: string
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled"
  paid: boolean
  amount: { value: string; currency: string }
  created_at: string
  metadata?: Record<string, string>
  confirmation?: { type: string; confirmation_url?: string }
}

/**
 * Создаёт платёж и возвращает адрес страницы оплаты.
 *
 * capture: true — деньги списываются сразу, без ручного подтверждения:
 * продвижение — цифровая услуга, двухфазность здесь только добавила бы
 * заказов, зависших между авторизацией и списанием.
 */
export async function createYookassaPayment(
  config: YookassaConfig,
  input: {
    amountRub: number
    description: string
    returnUrl: string
    metadata: Record<string, string>
    /** Ключ идемпотентности: повтор запроса с тем же ключом не создаёт второй платёж. */
    idempotenceKey: string
  },
): Promise<YookassaPayment> {
  const response = await fetch(`${API_BASE}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader(config),
      "Idempotence-Key": input.idempotenceKey,
    },
    body: JSON.stringify({
      amount: { value: formatRubAmount(input.amountRub), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: input.returnUrl },
      description: input.description.slice(0, 128),
      metadata: input.metadata,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`ЮKassa: создание платежа вернуло ${response.status}: ${detail.slice(0, 300)}`)
  }

  return await response.json() as YookassaPayment
}

/**
 * Перечитывает платёж напрямую из API.
 *
 * Единственный источник правды для webhook: уведомления не подписаны, и
 * активировать продвижение по содержимому уведомления значило бы дарить
 * его любому, кто узнал адрес обработчика.
 */
export async function fetchYookassaPayment(config: YookassaConfig, paymentId: string): Promise<YookassaPayment> {
  const response = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { "Authorization": authHeader(config) },
  })

  if (!response.ok) {
    throw new Error(`ЮKassa: чтение платежа вернуло ${response.status}`)
  }

  return await response.json() as YookassaPayment
}

/** «499» → «499.00»: ЮKassa принимает сумму строкой с копейками. */
export function formatRubAmount(amountRub: number): string {
  return amountRub.toFixed(2)
}

/**
 * Совпадает ли оплаченная сумма с тарифом.
 *
 * Сумма сверяется до копейки: платёж на 1 ₽ с подделанными метаданными
 * не должен активировать тариф за 3990.
 */
export function paymentMatchesAmount(payment: YookassaPayment, amountRub: number): boolean {
  return payment.amount.currency === "RUB" && payment.amount.value === formatRubAmount(amountRub)
}

/**
 * Достаёт id платежа из уведомления.
 *
 * Из уведомления больше ничего не используется — см. заметку о
 * безопасности в шапке файла.
 */
export function paymentIdFromWebhook(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const event = body as { event?: unknown; object?: { id?: unknown } }
  if (event.event !== "payment.succeeded" && event.event !== "payment.canceled") return null
  const id = event.object?.id
  return typeof id === "string" && id.length > 0 && id.length <= 64 ? id : null
}
