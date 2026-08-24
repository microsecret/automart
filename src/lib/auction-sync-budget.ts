export const AUCTION_SOURCE_STAGE_BUDGET_MS = 180_000
export const AUCTION_SOURCE_CONSECUTIVE_FAILURE_LIMIT = 3

export function auctionSourceStageBudgetExceeded(
  startedAtMs: number,
  nowMs = Date.now(),
  budgetMs = AUCTION_SOURCE_STAGE_BUDGET_MS,
) {
  return !Number.isFinite(startedAtMs)
    || !Number.isFinite(nowMs)
    || !Number.isFinite(budgetMs)
    || budgetMs <= 0
    || nowMs - startedAtMs >= budgetMs
}

export function remainingAuctionSourceItems(total: number, processed: number) {
  if (!Number.isFinite(total) || !Number.isFinite(processed)) return 0
  return Math.max(0, Math.floor(total) - Math.max(0, Math.floor(processed)))
}

export function auctionSourceStageStatus(checked: number, failed: number, deferred: number) {
  if (failed > 0) return checked > failed ? "PARTIAL" : "FAILED"
  return deferred > 0 ? "PARTIAL" : "SUCCEEDED"
}
