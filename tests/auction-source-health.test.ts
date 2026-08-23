import assert from "node:assert/strict"
import test from "node:test"
import {
  deriveAuctionSourceRunHealth,
  formatAuctionSyncDuration,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/auction-source-health.ts"

const NOW = new Date("2026-08-24T12:00:00Z")
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)

test("успешный последний запуск сбрасывает серию ошибок", () => {
  const health = deriveAuctionSourceRunHealth("ENCAR", [
    { source: "ENCAR", syncKind: "REFRESH", status: "FAILED", startedAt: minutesAgo(30), completedAt: minutesAgo(29), error: "timeout" },
    { source: "ENCAR", syncKind: "DISCOVERY", status: "SUCCEEDED", startedAt: minutesAgo(5), completedAt: minutesAgo(4), error: null },
  ], NOW)
  assert.equal(health.operationalStatus, "HEALTHY")
  assert.equal(health.consecutiveIssues, 0)
  assert.equal(health.latestRunDurationSeconds, 60)
})

test("частичные и неудачные запуски образуют видимую серию", () => {
  const health = deriveAuctionSourceRunHealth("KCAR", [
    { source: "KCAR", syncKind: "DISCOVERY", status: "SUCCEEDED", startedAt: minutesAgo(50), completedAt: minutesAgo(48), error: null },
    { source: "KCAR", syncKind: "REFRESH", status: "PARTIAL", startedAt: minutesAgo(20), completedAt: minutesAgo(18), error: "одна карточка пропущена" },
    { source: "KCAR", syncKind: "DISCOVERY", status: "FAILED", startedAt: minutesAgo(10), completedAt: minutesAgo(9), error: "источник недоступен" },
  ], NOW)
  assert.equal(health.operationalStatus, "FAILED")
  assert.equal(health.consecutiveIssues, 2)
  assert.equal(health.latestRunError, "источник недоступен")
})

test("долгий RUNNING помечается как зависший, короткий остаётся рабочим", () => {
  const oldRun = [{ source: "IAUTOS", syncKind: "REFRESH", status: "RUNNING", startedAt: minutesAgo(16), completedAt: null, error: null }]
  const currentRun = [{ ...oldRun[0], startedAt: minutesAgo(4) }]
  assert.equal(deriveAuctionSourceRunHealth("IAUTOS", oldRun, NOW).operationalStatus, "STUCK")
  assert.equal(deriveAuctionSourceRunHealth("IAUTOS", currentRun, NOW).operationalStatus, "RUNNING")
})

test("источник без истории не изображает ложный успех", () => {
  assert.equal(deriveAuctionSourceRunHealth("GOONET", [], NOW).operationalStatus, "NOT_RUN")
})

test("длительность выводится компактно", () => {
  assert.equal(formatAuctionSyncDuration(1), "1 сек")
  assert.equal(formatAuctionSyncDuration(125), "2 мин")
  assert.equal(formatAuctionSyncDuration(3_900), "1 ч 5 мин")
  assert.equal(formatAuctionSyncDuration(null), null)
})
