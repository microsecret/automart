import { NextRequest, NextResponse } from "next/server"
import { reconcilePendingPromotions } from "@/lib/promotion-reconcile"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN

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
 * Маршрут вызывается по расписанию каждые пять минут и спрашивает кассу
 * сам. Уведомление остаётся основным путём — оно быстрее; сверка ловит
 * то, что через него не прошло.
 *
 * Защита тем же токеном, что и остальные задачи по расписанию: сверка
 * ходит в кассу и меняет статусы заказов, снаружи ей делать нечего.
 */
export async function POST(request: NextRequest) {
  if (!PARSER_TOKEN) {
    return NextResponse.json({ error: "Сверка не настроена" }, { status: 503 })
  }
  if (request.headers.get("authorization") !== `Bearer ${PARSER_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await reconcilePendingPromotions()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Сверка платежей не выполнена:", error)
    return NextResponse.json({ error: "Сверка не выполнена" }, { status: 500 })
  }
}
