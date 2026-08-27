/**
 * Обёртка маршрутов фоновых задач бота.
 *
 * Шесть маршрутов — рассылка, продвижение в чатах, напоминания о
 * регистрации, подталкивание молчунов, уборка сообщений, уведомления по
 * сохранённым поискам — повторяли один и тот же каркас: проверить, что
 * ключ вообще настроен, сверить присланный ключ, выполнить работу,
 * поймать ошибку. Пять строк проверки ключа были скопированы дословно
 * шесть раз, причём в одном файле функцию ещё и переименовали, оставив
 * тело прежним.
 *
 * Маршруты открыты в интернет, а запускают они рассылку по сотне тысяч
 * подписчиков — поэтому проверка ключа здесь не мелочь, и хранить её в
 * одном месте надёжнее, чем в шести.
 */

import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

/**
 * Сверяет присланный ключ с настроенным.
 *
 * Сравнение через timingSafeEqual, а не через равенство строк: обычное
 * сравнение прекращается на первом несовпавшем символе, и по времени
 * ответа ключ можно подобрать посимвольно.
 */
function hasValidSecret(request: NextRequest, secret: string): boolean {
  const received = request.headers.get("x-telegram-bot-api-secret-token") || ""
  const expectedBuffer = Buffer.from(secret)
  const receivedBuffer = Buffer.from(received)
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

export type TelegramWorkerOptions = {
  /** Метка для журнала: по ней сбой находят среди остальных задач. */
  label: string
  /** Что ответить человеку при сбое. */
  errorMessage?: string
}

/**
 * Собирает обработчик POST для фоновой задачи бота.
 *
 * Работа получает сам запрос: части задач читают из тела параметры
 * запуска, остальные его игнорируют.
 */
export function createTelegramWorkerRoute<T>(
  handler: (request: NextRequest) => Promise<T>,
  options: TelegramWorkerOptions,
) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!secret) return NextResponse.json({ error: "Telegram не настроен" }, { status: 503 })
    if (!hasValidSecret(request, secret)) return NextResponse.json({ error: "Требуется ключ" }, { status: 401 })

    try {
      return NextResponse.json(await handler(request))
    } catch (error) {
      console.error(`${options.label}:`, error)
      return NextResponse.json(
        { error: options.errorMessage || "Не удалось выполнить задачу" },
        { status: 500 },
      )
    }
  }
}
