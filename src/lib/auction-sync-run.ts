import { prisma } from "@/lib/prisma"

const DEFAULT_STALE_RUN_AGE_MS = 15 * 60 * 1_000

/**
 * A parser request can be terminated by the reverse proxy or the deploy
 * process after the run row has been created. Close those abandoned rows
 * before the next run so the admin timeline reflects the real collector
 * state instead of showing an endless RUNNING job.
 */
/**
 * Источник указывается вызывающим кодом для читаемости, но на выборку не
 * влияет: очистка подбирает брошенные записи всех источников. Раньше строка
 * жила до следующего прогона того же источника, а медленный сбор не оставлял
 * на него времени — записи висели в RUNNING по полтора часа и портили метрику
 * надёжности.
 */
export async function closeStaleAuctionSyncRuns(
  _source: string,
  now = new Date(),
  maxAgeMs = DEFAULT_STALE_RUN_AGE_MS,
) {
  const staleBefore = new Date(now.getTime() - maxAgeMs)
  return prisma.auctionSyncRun.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: staleBefore },
    },
    data: {
      status: "FAILED",
      error: "Запуск был прерван до получения итогового ответа; следующий цикл продолжил сбор.",
      completedAt: now,
    },
  })
}
