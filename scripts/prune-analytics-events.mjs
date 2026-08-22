#!/usr/bin/env node

// Удаление устаревших событий посещений.
//
// Таблицы VisitEvent и ListingViewEvent растут без предела: каждое
// открытие страницы добавляет запись, и ничто их не удаляет. Панель
// администратора читает месяц визитов целиком, чтобы посчитать уникальных
// посетителей по дням, — при тысяче посетителей в сутки это тридцать
// тысяч записей на каждую загрузку панели.
//
// Хранить сырые события дольше трёх месяцев незачем: отчёты за более
// давние периоды никто не строит, а для сравнения год к году нужны
// сводки, а не отдельные посещения.
//
// Запуск: node scripts/prune-analytics-events.mjs [--dry-run] [--days=90]

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const dryRun = process.argv.includes("--dry-run")

const daysArg = process.argv.find((arg) => arg.startsWith("--days="))
const requestedDays = daysArg ? Number.parseInt(daysArg.slice("--days=".length), 10) : 90
// Меньше месяца хранить нельзя: панель показывает месячную статистику,
// и более короткий срок оставил бы её без данных.
const days = Number.isSafeInteger(requestedDays) && requestedDays >= 30 ? requestedDays : 90

/* Удаление идёт порциями, а не одним запросом.

   SQLite держит блокировку записи на всю операцию: удаление сотни тысяч
   строк разом остановит сайт на это время. Порция в пять тысяч проходит
   за доли секунды и отпускает базу между заходами. */
const BATCH = 5_000

async function pruneTable(name, model, cutoff) {
  const total = await model.count({ where: { createdAt: { lt: cutoff } } })
  if (!total) {
    console.log(`${name}: устаревших записей нет`)
    return 0
  }

  console.log(`${name}: к удалению ${total}`)
  if (dryRun) return 0

  let removed = 0
  // Пока остаются подходящие записи — удаляем следующую порцию.
  for (;;) {
    const batch = await model.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH,
    })
    if (!batch.length) break
    const result = await model.deleteMany({ where: { id: { in: batch.map((row) => row.id) } } })
    removed += result.count
    console.log(`  удалено ${removed} из ${total}`)
    if (batch.length < BATCH) break
  }
  return removed
}

async function main() {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  console.log(`Порог: ${cutoff.toISOString()} (старше ${days} дней)${dryRun ? " — пробный запуск" : ""}`)

  const visits = await pruneTable("VisitEvent", prisma.visitEvent, cutoff)
  const views = await pruneTable("ListingViewEvent", prisma.listingViewEvent, cutoff)

  console.log(`Итого удалено: ${visits + views}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
