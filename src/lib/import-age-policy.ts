import type { AuctionImportItem } from "@/lib/auction-import"

const DEFAULT_MAX_IMPORT_AGE_YEARS = 5
const MAX_CONFIGURABLE_IMPORT_AGE_YEARS = 20

function parseMaximumAge(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_CONFIGURABLE_IMPORT_AGE_YEARS ? parsed : null
}

/**
 * Selects an import-stock age horizon. It is a commercial filtering policy,
 * not a legal determination of the utilisation fee or customs eligibility.
 */
export function resolveMaximumImportAgeYears(requestedValue: unknown) {
  return parseMaximumAge(requestedValue)
    ?? parseMaximumAge(process.env.ENCAR_MAX_IMPORT_AGE_YEARS)
    ?? DEFAULT_MAX_IMPORT_AGE_YEARS
}

export type ImportAgeAssessment = {
  eligible: boolean
  maxAgeYears: number
  exactMonthKnown: boolean
}

/**
 * A year-only source record is retained through the entire boundary year.
 * This avoids falsely discarding a vehicle whose actual release day is still
 * within the configured horizon; the calculator then asks for verification.
 */
export function assessImportAge(item: Pick<AuctionImportItem, "year" | "manufacturedMonth">, maxAgeYears: number, now = new Date()): ImportAgeAssessment {
  const cutoff = new Date(now.getFullYear() - maxAgeYears, now.getMonth(), now.getDate())
  const monthMatch = item.manufacturedMonth?.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
  const exactMonthKnown = Boolean(monthMatch)
  const sourceYear = monthMatch ? Number(monthMatch[1]) : item.year
  // Encar reports year-month without the day. Treat the last day of that
  // month as the latest possible release date, which is the non-destructive
  // choice at the age boundary.
  const latestPossibleRelease = monthMatch
    ? new Date(sourceYear, Number(monthMatch[2]), 0)
    : new Date(sourceYear, 11, 31)

  return { eligible: latestPossibleRelease >= cutoff, maxAgeYears, exactMonthKnown }
}
