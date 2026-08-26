/**
 * Единая проверка прав и обработка ошибок в маршрутах админки.
 *
 * Одна и та же проверка «сессия есть и роль подходит» была написана
 * двадцать четыре раза шестью несовместимыми способами, с тремя разными
 * текстами отказа. Хуже расхождения в текстах оказалось расхождение в
 * логике: часть маршрутов сравнивала роль строкой напрямую, в обход
 * нормализации из permissions.ts, и вела себя иначе на тех же данных.
 *
 * Отсюда правило: маршрут админки не проверяет права сам, а получает
 * готовую сессию либо готовый отказ.
 */

import { NextResponse } from "next/server"
import { getServerSession, type Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { can, isAdmin, isModerator, type Permission } from "@/lib/permissions"

/** Сессия сотрудника либо готовый ответ с отказом. */
export type GuardResult =
  | { session: Session; denied?: undefined }
  | { session?: undefined; denied: NextResponse }

/**
 * Ответ на отсутствие прав.
 *
 * 401 — «не представились», 403 — «представились, но не положено». Раньше
 * один админский маршрут отвечал 403 без сессии, остальные 401, и клиент
 * не мог отличить «войдите» от «вам сюда нельзя».
 */
function deny(status: 401 | 403): NextResponse {
  return NextResponse.json(
    { error: status === 401 ? "Требуется вход" : "Недостаточно прав" },
    { status },
  )
}

/** Требует роль администратора. */
export async function requireAdminSession(): Promise<GuardResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { denied: deny(401) }
  if (!isAdmin(session.user.role)) return { denied: deny(403) }
  return { session }
}

/** Требует роль администратора или модератора. */
export async function requireModeratorSession(): Promise<GuardResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { denied: deny(401) }
  if (!isModerator(session.user.role) && !isAdmin(session.user.role)) return { denied: deny(403) }
  return { session }
}

/** Требует конкретное полномочие из словаря прав. */
export async function requirePermission(permission: Permission): Promise<GuardResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { denied: deny(401) }
  if (!can(session.user.role, permission)) return { denied: deny(403) }
  return { session }
}

/**
 * Выполняет работу маршрута, превращая непойманную ошибку в ответ 500.
 *
 * Пятнадцать маршрутов повторяли один и тот же try/catch, различаясь
 * только строкой лога; два при этом проглатывали ошибку молча, без записи
 * в журнал, — такой сбой не виден ни в мониторинге, ни пользователю.
 */
export async function runAdminRoute(
  label: string,
  handler: () => Promise<NextResponse>,
  errorMessage = "Не удалось выполнить операцию",
): Promise<NextResponse> {
  try {
    return await handler()
  } catch (error) {
    console.error(`${label}:`, error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
