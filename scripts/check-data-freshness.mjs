/**
 * Сторож свежести данных.
 *
 * 19 сентября 2026 деплой стёр расписание cron, и проект трое суток жил без
 * всех двенадцати фоновых заданий. Ни один привычный признак не сработал:
 * служба `active`, перезапусков ноль, все страницы отвечают 200, в коде
 * ничего не сломано. Сайт показывал трёхдневные цены топлива как свежие.
 *
 * Поломку видно только по одному признаку — данные перестали обновляться.
 * Этот скрипт и смотрит именно на него: у каждого раздела свой срок годности,
 * взятый из расписания его задания с запасом.
 *
 * Запуск: node scripts/check-data-freshness.mjs
 * Код возврата: 0 — всё свежо, 1 — что-то встало (годится для cron и мониторинга).
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/* Сроки годности.
 *
 * Берутся не с потолка, а из расписания задания с тройным запасом: импорт АЗС
 * идёт каждые 15 минут, но прогон длится до трёх минут и может разок не
 * поймать flock — час здесь означает «пропущено четыре подряд», то есть уже
 * не случайность.
 *
 * Разделы, которые наполняют люди (объявления, форум), сроку не подлежат:
 * тишина в выходные там нормальна и ни о чём не говорит. */
const CHECKS = [
  {
    name: "Цены на топливо",
    model: "fuelPriceImport",
    field: "createdAt",
    maxAgeHours: 1,
    job: "automart-fuel-scraper (*/15)",
  },
  {
    name: "Аукционные лоты",
    model: "auctionSyncRun",
    field: "startedAt",
    maxAgeHours: 2,
    job: "automart-encar-collector (*/20)",
  },
  {
    name: "Курсы валют",
    model: "exchangeRate",
    field: "updatedAt",
    maxAgeHours: 24,
    job: "automart-auction-rates (17 */6)",
  },
  {
    name: "Новости",
    model: "news",
    field: "createdAt",
    maxAgeHours: 12,
    job: "atlas-news.service --loop",
  },
  {
    name: "Посещения",
    model: "visitEvent",
    field: "createdAt",
    maxAgeHours: 24,
    job: "живой трафик (не задание)",
  },
]

function describeAge(ms) {
  const hours = ms / 3_600_000
  if (hours < 1) return `${Math.round(hours * 60)} мин назад`
  if (hours < 48) return `${Math.round(hours)} ч назад`
  return `${Math.round(hours / 24)} сут назад`
}

async function main() {
  const now = Date.now()
  const stale = []

  console.log("Свежесть данных\n")

  for (const check of CHECKS) {
    let row
    try {
      row = await prisma[check.model].aggregate({
        _max: { [check.field]: true },
        _count: true,
      })
    } catch (error) {
      console.log(`  ✗ ${check.name.padEnd(20)} ошибка запроса: ${String(error.message).slice(0, 80)}`)
      stale.push({ ...check, reason: "запрос не прошёл" })
      continue
    }

    const last = row._max[check.field]
    if (!last) {
      console.log(`  ✗ ${check.name.padEnd(20)} записей нет`)
      stale.push({ ...check, reason: "таблица пуста" })
      continue
    }

    const ageMs = now - new Date(last).getTime()
    const overdue = ageMs > check.maxAgeHours * 3_600_000
    const mark = overdue ? "✗" : "✓"
    const count = String(row._count).padStart(7)

    console.log(`  ${mark} ${check.name.padEnd(20)} ${count} зап.  ${describeAge(ageMs)}`)

    if (overdue) {
      stale.push({ ...check, reason: `не обновлялось ${describeAge(ageMs)}, норма — ${check.maxAgeHours} ч` })
    }
  }

  if (!stale.length) {
    console.log("\nВсё обновляется в срок.")
    return 0
  }

  console.log(`\nВСТАЛО РАЗДЕЛОВ: ${stale.length}\n`)
  for (const item of stale) {
    console.log(`  ${item.name}: ${item.reason}`)
    console.log(`    источник — ${item.job}`)
  }

  /* Расписание проверяется отдельно: чаще всего причина именно в нём, и без
     этой подсказки поиск снова уйдёт в код, где всё исправно. */
  console.log("\nПроверьте расписание: crontab -l | grep -c automart")
  console.log("Должно быть 12 заданий. Копии — /root/cron-snapshots/")

  return 1
}

main()
  .then(async (code) => {
    await prisma.$disconnect()
    process.exit(code)
  })
  .catch(async (error) => {
    console.error("Сторож свежести упал:", error)
    await prisma.$disconnect()
    process.exit(1)
  })
