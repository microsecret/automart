/**
 * Разовое приведение городов и марок уже поданных объявлений к справочникам.
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
 *   node22 --experimental-strip-types scripts/normalize-listing-catalog.mjs --dry-run
 *   node22 --experimental-strip-types scripts/normalize-listing-catalog.mjs
 */

import { PrismaClient } from "@prisma/client"
import { normalizeListingCity } from "../src/lib/listing-city.ts"
import { normalizeListingMake } from "../src/lib/listing-make.ts"

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

/* Марки — только у транспорта: у запчасти поле `make` означает не её
   производителя, а машину, к которой она подходит, и приводить его к
   справочнику брендов здесь не требуется. */
const makes = await (async () => {
  const rows = await prisma.vehicle.findMany({ select: { id: true, make: true } })
  let changed = 0
  for (const row of rows) {
    const next = normalizeListingMake(row.make)
    if (!next || next === row.make) continue
    console.log(`  марка: ${JSON.stringify(row.make)} → ${JSON.stringify(next)}`)
    changed += 1
    if (!dryRun) await prisma.vehicle.update({ where: { id: row.id }, data: { make: next } })
  }
  return { scanned: rows.length, changed }
})()

console.log(dryRun ? "— ПРОБНЫЙ ПРОГОН, ничего не записано —" : "— справочники применены —")
console.log(`города, машин:      ${vehicles.scanned}, изменено ${vehicles.changed}`)
console.log(`города, запчастей:  ${parts.scanned}, изменено ${parts.changed}`)
console.log(`марки, машин:       ${makes.scanned}, изменено ${makes.changed}`)

await prisma.$disconnect()
