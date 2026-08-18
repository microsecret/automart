import { createHash } from "node:crypto"

// Партнёрская программа: чем больше приглашённых оплатили тариф, тем выше
// процент. Шкала прогрессивная, но вознаграждение считается по проценту на
// момент оплаты — уже начисленное не пересчитывается задним числом.

export type ReferralTier = {
  minPaidInvitees: number
  percent: number
  label: string
}

export const REFERRAL_TIERS: readonly ReferralTier[] = [
  { minPaidInvitees: 0, percent: 20, label: "Старт" },
  { minPaidInvitees: 3, percent: 30, label: "Активный" },
  { minPaidInvitees: 10, percent: 40, label: "Продвинутый" },
  { minPaidInvitees: 25, percent: 50, label: "Максимальный" },
]

/** Уровень партнёра по числу приглашённых, которые уже оплатили тариф. */
export function resolveReferralTier(paidInvitees: number): ReferralTier {
  let current = REFERRAL_TIERS[0]
  for (const tier of REFERRAL_TIERS) {
    if (paidInvitees >= tier.minPaidInvitees) current = tier
  }
  return current
}

/** Следующий уровень и сколько до него осталось — для подсказки в кабинете. */
export function nextReferralTier(paidInvitees: number) {
  const next = REFERRAL_TIERS.find((tier) => tier.minPaidInvitees > paidInvitees)
  return next ? { tier: next, needed: next.minPaidInvitees - paidInvitees } : null
}

/**
 * Реферальный код пользователя.
 *
 * Выводится из идентификатора, поэтому не хранится отдельно и не может
 * разойтись с аккаунтом. Хеш обрезан до восьми символов: этого достаточно,
 * чтобы код не угадывался перебором, и он остаётся коротким для ссылки.
 */
export function referralCodeForUser(userId: string) {
  return createHash("sha256").update(`referral:${userId}`).digest("hex").slice(0, 8).toUpperCase()
}

/** Сумма вознаграждения. Округление вниз, чтобы не обещать лишнего. */
export function calculateRewardAmount(orderAmountRub: number, percent: number) {
  if (!Number.isFinite(orderAmountRub) || orderAmountRub <= 0) return 0
  return Math.floor((orderAmountRub * percent) / 100)
}

export type ReferralBalance = {
  accruedRub: number
  paidOutRub: number
  availableRub: number
}

/**
 * Баланс партнёра.
 *
 * Выплаты проводит администратор вручную по расчётному счёту, поэтому
 * доступная сумма — это разница между начисленным и уже переведённым.
 */
export function buildReferralBalance(accruedRub: number, paidOutRub: number): ReferralBalance {
  const available = Math.max(0, accruedRub - paidOutRub)
  return { accruedRub, paidOutRub, availableRub: available }
}
