/**
 * Разовое приведение городов уже поданных объявлений к справочнику.
 *
 * Нормализация в маршруте подачи защищает только новые объявления, а в
 * базе к моменту её появления лежали записи вроде «уфа» строчными и
 * «йошкар ола» без дефиса. Фильтр каталога их не находил, и два
 * уфимских продавца получали ноль просмотров по своему же городу.
 *
 * Правила берутся из самого модуля, а не копируются: вторая копия
 * разошлась бы с первой при первой правке. Нужен Node 22+ с
 * `--experimental-strip-types`, иначе он не прочтёт TypeScript.
 *
 * Запуск с сервера:
 *   node22 --experimental-strip-types scripts/normalize-listing-cities.mjs --dry-run
 *   node22 --experimental-strip-types scripts/normalize-listing-cities.mjs
 */

import { PrismaClient } from "@prisma/client"
import { normalizeListingCity } from "../src/lib/listing-city.ts"

const prisma = new PrismaClient()
const dryRun = process.argv.includes("--dry-run")

async function normalizeTable(name, readAll, writeOne) {
  const rows = await readAll()
  let changed = 0
  for (const row of rows) {
    const next = normalizeListingCity(row.location)
    if (!next || next === row.location) continue
    console.log(`  ${name}: ${JSON.stringify(row.location)} → ${JSON.stringify(next)}`)
    changed += 1
    if (!dryRun) await writeOne(row.id, next)
  }
  return { scanned: rows.length, changed }
}

const vehicles = await normalizeTable(
  "машина",
  () => prisma.vehicle.findMany({ select: { id: true, location: true } }),
  (id, location) => prisma.vehicle.update({ where: { id }, data: { location } }),
)

const parts = await normalizeTable(
  "запчасть",
  () => prisma.part.findMany({ select: { id: true, location: true } }),
  (id, location) => prisma.part.update({ where: { id }, data: { location } }),
)

console.log(dryRun ? "— ПРОБНЫЙ ПРОГОН, ничего не записано —" : "— города приведены —")
console.log(`машин просмотрено:     ${vehicles.scanned}, изменено ${vehicles.changed}`)
console.log(`запчастей просмотрено: ${parts.scanned}, изменено ${parts.changed}`)

await prisma.$disconnect()
