import crypto from "node:crypto"

/**
 * Проверка служебного ключа в заголовке Authorization: Bearer <ключ>.
 *
 * Четырнадцать маршрутов парсера и сверки платежей сравнивали заголовок
 * обычным «!==». Такое сравнение прекращается на первом несовпавшем
 * символе, и по времени ответа ключ в теории подбирается посимвольно, а
 * ключ открывает импорт лотов и сверку платежей (аудит безопасности
 * 28.10.2026). Здесь сравнение за постоянное время — так же, как в
 * telegram-worker-route.
 *
 * Пустой настроенный ключ не пропускает никого: иначе «Bearer » без ключа
 * совпал бы с ненастроенным сервером.
 */
export function hasBearerToken(request: Request, expected: string | undefined | null): boolean {
  if (!expected) return false
  const received = request.headers.get("authorization") || ""
  const expectedBuffer = Buffer.from(`Bearer ${expected}`)
  const receivedBuffer = Buffer.from(received)
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}
