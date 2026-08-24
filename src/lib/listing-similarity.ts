export interface VehicleSimilarityCandidate {
  id: string
  vehicleType: string
  make: string
  model: string
  generation?: string | null
  bodyType: string | null
  year: number
  price: number
  fuelType: string | null
  transmission: string | null
  driveType: string | null
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("ru-RU") || ""
}

function sameKnownValue(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = normalized(left)
  return Boolean(normalizedLeft && normalizedLeft === normalized(right))
}

function priceDistance(target: VehicleSimilarityCandidate, candidate: VehicleSimilarityCandidate): number {
  if (target.price <= 0 || candidate.price <= 0) return Number.POSITIVE_INFINITY
  return Math.abs(Math.log(candidate.price / target.price))
}

/**
 * Оценка похожести использует только факты из объявлений. Она не пытается
 * угадать класс машины по названию модели и не смешивает виды транспорта.
 */
export function scoreVehicleSimilarity(
  target: VehicleSimilarityCandidate,
  candidate: VehicleSimilarityCandidate,
): number {
  if (target.id === candidate.id || target.vehicleType !== candidate.vehicleType) {
    return Number.NEGATIVE_INFINITY
  }

  let score = 0
  const sameMake = sameKnownValue(target.make, candidate.make)
  const distance = priceDistance(target, candidate)

  if (sameMake) score += 24
  if (sameMake && sameKnownValue(target.model, candidate.model)) score += 34
  if (sameMake && sameKnownValue(target.generation, candidate.generation)) score += 14
  if (sameKnownValue(target.bodyType, candidate.bodyType)) score += 14
  if (sameKnownValue(target.fuelType, candidate.fuelType)) score += 6
  if (sameKnownValue(target.transmission, candidate.transmission)) score += 5
  if (sameKnownValue(target.driveType, candidate.driveType)) score += 4

  score += Math.max(0, 16 - Math.abs(target.year - candidate.year) * 3)
  if (Number.isFinite(distance)) score += Math.max(0, 30 - distance * 42)

  return score
}

export function rankSimilarVehicles<T extends VehicleSimilarityCandidate>(
  target: VehicleSimilarityCandidate,
  candidates: readonly T[],
  limit = 4,
): T[] {
  const safeLimit = Math.max(0, Math.min(20, Math.trunc(limit)))
  if (safeLimit === 0) return []

  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreVehicleSimilarity(target, candidate),
      priceDistance: priceDistance(target, candidate),
      yearDistance: Math.abs(target.year - candidate.year),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => (
      right.score - left.score
      || left.priceDistance - right.priceDistance
      || left.yearDistance - right.yearDistance
      || left.index - right.index
    ))
    .slice(0, safeLimit)
    .map((item) => item.candidate)
}
