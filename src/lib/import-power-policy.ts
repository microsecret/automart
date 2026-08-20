/**
 * Порог мощности для льготного утилизационного сбора.
 *
 * Постановление Правительства РФ № 1291 задаёт льготный коэффициент 0,17 для
 * машин, ввозимых физическим лицом для личного пользования, при мощности
 * двигателя до 117,68 кВт — это ровно 160 л.с. Выше порога сбор считается по
 * коммерческой ставке и вырастает в десятки раз, поэтому такие лоты покупателю
 * площадки бесполезны: он придёт за ценой, а получит счёт на сотни тысяч.
 *
 * Для электромобилей и последовательных гибридов порог вдвое ниже — 58,84 кВт,
 * то есть 80 л.с.
 */

/** Порог для двигателей внутреннего сгорания: 117,68 кВт. */
export const MAX_PREFERENTIAL_HORSEPOWER = 160

/** Порог для электромобилей и последовательных гибридов: 58,84 кВт. */
export const MAX_PREFERENTIAL_ELECTRIC_HORSEPOWER = 80

/** Типы топлива, к которым применяется пониженный электрический порог. */
const ELECTRIC_FUEL_TYPES = new Set(["ELECTRIC", "HYBRID"])

export type ImportPowerAssessment = {
  eligible: boolean
  /** Порог, применённый к этому лоту. */
  limit: number
  /** Мощность неизвестна: лот пропускается, решение принимает модератор. */
  unknownPower: boolean
}

/**
 * Проверяет лот по мощности.
 *
 * Лот без указанной мощности не отбраковывается: источники часто не заполняют
 * это поле, и отсев по нему выбросил бы годные машины. Такой лот доходит до
 * карточки, где мощность видна покупателю.
 */
export function assessImportPower(item: {
  power?: number | null
  fuelType?: string | null
}): ImportPowerAssessment {
  const limit = ELECTRIC_FUEL_TYPES.has(String(item.fuelType || "").toUpperCase())
    ? MAX_PREFERENTIAL_ELECTRIC_HORSEPOWER
    : MAX_PREFERENTIAL_HORSEPOWER

  const power = typeof item.power === "number" && Number.isFinite(item.power) ? item.power : null
  if (power === null || power <= 0) return { eligible: true, limit, unknownPower: true }

  return { eligible: power <= limit, limit, unknownPower: false }
}

/**
 * Убирает из выдачи ранее собранные машины мощнее порога.
 *
 * Фильтр при импорте действует только на новые лоты, а в каталоге остаются
 * собранные до его появления. Покупатель пришёл бы за ценой и получил счёт на
 * сотни тысяч сверху, поэтому такие карточки скрываются тем же статусом, что
 * и вышедшие за горизонт по возрасту.
 */
export async function excludeListingsOutsideImportPowerPolicy(source?: string) {
  const { prisma } = await import("@/lib/prisma")
  const sourceFilter = source ? { source } : {}

  const excluded = await prisma.auctionListing.updateMany({
    where: {
      ...sourceFilter,
      status: "ACTIVE",
      OR: [
        { fuelType: { notIn: ["ELECTRIC", "HYBRID"] }, power: { gt: MAX_PREFERENTIAL_HORSEPOWER } },
        { fuelType: null, power: { gt: MAX_PREFERENTIAL_HORSEPOWER } },
        { fuelType: { in: ["ELECTRIC", "HYBRID"] }, power: { gt: MAX_PREFERENTIAL_ELECTRIC_HORSEPOWER } },
      ],
    },
    data: { status: "POLICY_EXCLUDED" },
  })
  return excluded.count
}
