/**
 * Разовая чистка накопленных цен АЗС.
 *
 * Отсев в `upsertImportedStations` защищает только новые прогоны, а в
 * базе к моменту его появления лежало семьдесят шесть тысяч цен, среди
 * которых около пятой части неправдоподобны: 195 ₽ за АИ-95 в Тюмени,
 * 129 ₽ в Казани. До следующего полного обхода они продолжали бы
 * показываться водителям как настоящие.
 *
 * Скрипт прогоняет уже записанное через ту же функцию, что стоит на
 * входе, — иначе чистка и отсев разошлись бы в правилах.
 *
 * Правила отсева не копируются, а берутся из самого модуля: вторая
 * копия коридора разошлась бы с первой при первой же правке, и чистка
 * начала бы удалять не то, что отсеивает запись. Нужен Node 22+ с
 * `--experimental-strip-types`, иначе он не прочтёт TypeScript.
 *
 * Запуск с сервера:
 *   node22 --experimental-strip-types scripts/clean-imported-fuel-prices.mjs --dry-run
 *   node22 --experimental-strip-types scripts/clean-imported-fuel-prices.mjs
 */

import { PrismaClient } from "@prisma/client"
import { sanitizeStationPrices } from "../src/lib/fuel-price-sanity.ts"

const prisma = new PrismaClient()
const dryRun = process.argv.includes("--dry-run")

const BATCH = 500

async function main() {
  let cursor = null
  let scanned = 0
  let stationsTouched = 0
  let removed = 0
  const removedByFuel = {}

  for (;;) {
    const stations = await prisma.fuelStationImport.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        brand: true,
        prices: { select: { id: true, fuel: true, priceRub: true } },
      },
    })
    if (!stations.length) break
    cursor = stations[stations.length - 1].id

    for (const station of stations) {
      scanned += 1
      if (!station.prices.length) continue

      const kept = sanitizeStationPrices(station.prices)
      const keptIds = new Set(kept.map((price) => price.id))
      const doomed = station.prices.filter((price) => !keptIds.has(price.id))
      if (!doomed.length) continue

      stationsTouched += 1
      removed += doomed.length
      for (const price of doomed) {
        removedByFuel[price.fuel] = (removedByFuel[price.fuel] || 0) + 1
      }

      if (!dryRun) {
        await prisma.fuelPriceImport.deleteMany({
          where: { id: { in: doomed.map((price) => price.id) } },
        })
      }
    }

    process.stdout.write(`\rпросмотрено станций: ${scanned}`)
  }

  process.stdout.write("\n")
  console.log(dryRun ? "— ПРОБНЫЙ ПРОГОН, ничего не удалено —" : "— цены удалены —")
  console.log(`станций просмотрено: ${scanned}`)
  console.log(`станций затронуто:   ${stationsTouched}`)
  console.log(`цен снято:           ${removed}`)
  console.log("по маркам:", removedByFuel)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
