/**
 * Единая проверка входа в обычных API-маршрутах.
 *
 * Одна и та же проверка «сессия есть» была написана восемьдесят два раза
 * в пятидесяти шести файлах, причём отказ формулировался пятью разными
 * способами: «Unauthorized», «Требуется вход», «Необходимо войти в
 * аккаунт» и ещё двумя. Клиент не может показать человеку внятное
 * сообщение, когда сервер отвечает по-разному на одну и ту же ситуацию.
 *
 * Для админских маршрутов есть свой страж — admin-route-guard.ts: там
 * кроме входа проверяются роли и полномочия.
 */

import { NextResponse } from "next/server"
import { getServerSession, type Session } from "next-auth"
import { authOptions } from "@/lib/auth"

/** Сессия вошедшего либо готовый ответ с отказом. */
export type SessionGuardResult =
  | { session: Session; userId: string; denied?: undefined }
  | { session?: undefined; userId?: undefined; denied: NextResponse }

/**
 * Требует вошедшего пользователя.
 *
 * Возвращает и сессию, и его идентификатор: почти каждый маршрут дальше
 * обращается именно к `session.user.id`, и отдельная проверка на его
 * наличие повторялась бы в каждом из них.
 */
export async function requireUser(): Promise<SessionGuardResult> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return {
      denied: NextResponse.json({ error: "Требуется вход" }, { status: 401 }),
    }
  }

  return { session, userId: session.user.id }
}

/**
 * Читает сессию, не требуя входа.
 *
 * Для маршрутов, которые отвечают и гостю, но показывают вошедшему
 * больше: избранное в выдаче, свои объявления среди чужих.
 */
export async function optionalUser(): Promise<{ session: Session | null; userId: string | null }> {
  const session = await getServerSession(authOptions)
  return { session: session ?? null, userId: session?.user?.id ?? null }
}
