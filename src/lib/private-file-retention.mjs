export const DEFAULT_PRIVATE_FILE_MIN_AGE_HOURS = 24
const MAX_PRIVATE_FILE_MIN_AGE_HOURS = 24 * 365

/**
 * @typedef {{ storageKey: string, modifiedAtMs: number }} PrivateFileCandidate
 * @typedef {{ apply: boolean, minAgeHours: number }} PrivateFileRetentionOptions
 */

/** @param {string[]} args @returns {PrivateFileRetentionOptions} */
export function parsePrivateFileRetentionOptions(args) {
  const apply = args.includes("--apply")
  const ageArg = args.find((arg) => arg.startsWith("--min-age-hours="))
  const rawMinAgeHours = ageArg?.slice("--min-age-hours=".length)
  const minAgeHours = rawMinAgeHours && /^\d+$/.test(rawMinAgeHours)
    ? Number(rawMinAgeHours)
    : ageArg
      ? Number.NaN
      : DEFAULT_PRIVATE_FILE_MIN_AGE_HOURS

  if (!Number.isSafeInteger(minAgeHours) || minAgeHours < 1 || minAgeHours > MAX_PRIVATE_FILE_MIN_AGE_HOURS) {
    throw new Error(`--min-age-hours must be an integer from 1 to ${MAX_PRIVATE_FILE_MIN_AGE_HOURS}`)
  }

  return { apply, minAgeHours }
}

/** @param {string} value */
export function isSafePrivateMessageStorageKey(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/i.test(value)
}

/**
 * @param {PrivateFileCandidate[]} candidates
 * @param {ReadonlySet<string>} referencedStorageKeys
 * @param {number} cutoffMs
 * @returns {PrivateFileCandidate[]}
 */
export function selectOrphanedPrivateFiles(candidates, referencedStorageKeys, cutoffMs) {
  return candidates.filter((candidate) => (
    candidate.modifiedAtMs < cutoffMs && !referencedStorageKeys.has(candidate.storageKey)
  ))
}
