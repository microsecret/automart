export const AUCTION_SYNC_STUCK_AFTER_MS = 15 * 60 * 1_000

export type AuctionOperationalStatus = "HEALTHY" | "RUNNING" | "DEGRADED" | "FAILED" | "STUCK" | "NOT_RUN"

export type AuctionSyncRunSnapshot = {
  source: string
  syncKind: string
  status: string
  startedAt: Date | string
  completedAt: Date | string | null
  error: string | null
}

export type AuctionSourceRunHealth = {
  operationalStatus: AuctionOperationalStatus
  latestRunStatus: string | null
  latestRunKind: string | null
  latestRunStartedAt: Date | string | null
  latestRunCompletedAt: Date | string | null
  latestRunDurationSeconds: number | null
  consecutiveIssues: number
  latestRunError: string | null
}

export const AUCTION_OPERATIONAL_STATUS_LABELS: Record<AuctionOperationalStatus, string> = {
  HEALTHY: "Синхронизация в норме",
  RUNNING: "Синхронизация идёт",
  DEGRADED: "Завершено частично",
  FAILED: "Последний запуск не удался",
  STUCK: "Запуск завис",
  NOT_RUN: "Запусков ещё не было",
}

function timestamp(value: Date | string | null) {
  if (!value) return null
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(result) ? result : null
}

export function formatAuctionSyncDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} сек`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours} ч ${remainder} мин` : `${hours} ч`
}

export function deriveAuctionSourceRunHealth(
  source: string,
  runs: AuctionSyncRunSnapshot[],
  now = new Date(),
  stuckAfterMs = AUCTION_SYNC_STUCK_AFTER_MS,
): AuctionSourceRunHealth {
  const sourceRuns = runs
    .filter((run) => run.source === source)
    .sort((left, right) => (timestamp(right.startedAt) || 0) - (timestamp(left.startedAt) || 0))
  const latest = sourceRuns[0]

  if (!latest) {
    return {
      operationalStatus: "NOT_RUN",
      latestRunStatus: null,
      latestRunKind: null,
      latestRunStartedAt: null,
      latestRunCompletedAt: null,
      latestRunDurationSeconds: null,
      consecutiveIssues: 0,
      latestRunError: null,
    }
  }

  const nowMs = now.getTime()
  const startedAtMs = timestamp(latest.startedAt)
  const completedAtMs = timestamp(latest.completedAt)
  const durationEnd = completedAtMs ?? (latest.status === "RUNNING" ? nowMs : null)
  const latestRunDurationSeconds = startedAtMs !== null && durationEnd !== null
    ? Math.max(0, Math.round((durationEnd - startedAtMs) / 1_000))
    : null
  const stuck = latest.status === "RUNNING"
    && startedAtMs !== null
    && nowMs - startedAtMs >= stuckAfterMs

  let consecutiveIssues = 0
  for (const run of sourceRuns) {
    if (run.status === "RUNNING") continue
    if (run.status === "FAILED" || run.status === "PARTIAL") {
      consecutiveIssues += 1
      continue
    }
    break
  }

  const operationalStatus: AuctionOperationalStatus = stuck
    ? "STUCK"
    : latest.status === "RUNNING"
      ? "RUNNING"
      : latest.status === "FAILED"
        ? "FAILED"
        : latest.status === "PARTIAL"
          ? "DEGRADED"
          : latest.status === "SUCCEEDED"
            ? "HEALTHY"
            : "DEGRADED"

  return {
    operationalStatus,
    latestRunStatus: latest.status,
    latestRunKind: latest.syncKind,
    latestRunStartedAt: latest.startedAt,
    latestRunCompletedAt: latest.completedAt,
    latestRunDurationSeconds,
    consecutiveIssues,
    latestRunError: latest.error,
  }
}
