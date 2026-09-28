import { processWeeklyDigest } from "@/lib/telegram-weekly-digest"
import { createTelegramWorkerRoute } from "@/lib/telegram-worker-route"

export const dynamic = "force-dynamic"

/* Еженедельное письмо в боте. Запускается cron раз в день; кому пора —
   решает сама задача. ?dryRun=1 только считает получателей. */
export const POST = createTelegramWorkerRoute(
  (request) => processWeeklyDigest({ dryRun: request.nextUrl.searchParams.get("dryRun") === "1" }),
  { label: "Еженедельное письмо в боте", errorMessage: "Не удалось разослать еженедельное письмо" },
)
