import assert from "node:assert/strict"
import test from "node:test"
import {
  DEFAULT_PRIVATE_FILE_MIN_AGE_HOURS,
  parsePrivateFileRetentionOptions,
  selectOrphanedPrivateFiles,
} from "../src/lib/private-file-retention.mjs"

test("очистка приватных файлов по умолчанию работает только как dry-run", () => {
  assert.deepEqual(parsePrivateFileRetentionOptions([]), {
    apply: false,
    minAgeHours: DEFAULT_PRIVATE_FILE_MIN_AGE_HOURS,
  })
})

test("применение и возраст требуют явных корректных параметров", () => {
  assert.deepEqual(parsePrivateFileRetentionOptions(["--apply", "--min-age-hours=48"]), {
    apply: true,
    minAgeHours: 48,
  })
  assert.throws(() => parsePrivateFileRetentionOptions(["--min-age-hours=0"]), /integer from 1/)
  assert.throws(() => parsePrivateFileRetentionOptions(["--min-age-hours=24.5"]), /integer from 1/)
})

test("удаляются только старые ключи, отсутствующие в базе", () => {
  const now = Date.now()
  const oldReferenced = "11111111-1111-4111-8111-111111111111.jpg"
  const oldOrphan = "22222222-2222-4222-8222-222222222222.jpg"
  const youngOrphan = "33333333-3333-4333-8333-333333333333.jpg"
  const candidates = [
    { storageKey: oldReferenced, modifiedAtMs: now - 48 * 60 * 60 * 1000 },
    { storageKey: oldOrphan, modifiedAtMs: now - 48 * 60 * 60 * 1000 },
    { storageKey: youngOrphan, modifiedAtMs: now - 1_000 },
  ]

  assert.deepEqual(
    selectOrphanedPrivateFiles(candidates, new Set([oldReferenced]), now - 24 * 60 * 60 * 1000),
    [candidates[1]],
  )
})
