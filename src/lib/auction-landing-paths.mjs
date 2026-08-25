/**
 * Убирает дубли публичных адресов, выбирая наиболее полную группу лотов.
 * Модуль не зависит от Next.js и Prisma, поэтому его проверяет штатный
 * node:test без отдельного загрузчика TypeScript.
 *
 * @template {{ countrySlug: string, makeSlug: string, total: number }} T
 * @param {readonly T[]} landings
 * @returns {T[]}
 */
export function uniqueAuctionLandingsByPath(landings) {
  const byPath = new Map()

  for (const landing of landings) {
    const key = `${landing.countrySlug}/${landing.makeSlug}`
    const current = byPath.get(key)
    if (!current || landing.total > current.total) byPath.set(key, landing)
  }

  return [...byPath.values()]
}
