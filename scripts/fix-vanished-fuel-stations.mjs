/**
 * Разовая чистка АЗС, которые источник давно перестал отдавать.
 *
 * Сбор до 29.09.2026 никогда не удалял точки: пропавшая из ГдеБЕНЗ или
 * ГдеЗаправки заправка оставалась в базе и на карте навсегда. Так в центре
 * Уфы стояла «Татнефть», которой в городе нет, — пользовательская метка
 * ГдеБЕНЗ, снятая источником 19 сентября.
 *
 * Теперь сбор чистит пропавшее сам после каждого удачного региона, но
 * накопленный хвост уйдёт только за ближайшие прогоны. Скрипт убирает его
 * сразу и, главное, в пробном режиме показывает, что именно правило
 * удалит, — замер по базе, а не рассуждение.
 *
 * Правила не копируются, а берутся из тех же модулей, что у сбора: иначе
 * чистка и сбор разошлись бы при первой правке. Число станций в ответе
 * источника здесь неизвестно, поэтому вместо него берётся число точек
 * региона, обновлённых за последние сутки, — оно не меньше ответа, и
 * обрезанный потолком регион пропускается с запасом.
 *
 * Нужен Node 22+ с `--experimental-strip-types`. Запуск из корня проекта:
 *   /root/node22/bin/node --experimental-strip-types scripts/fix-vanished-fuel-stations.mjs          — пробный
 *   /root/node22/bin/node --experimental-strip-types scripts/fix-vanished-fuel-stations.mjs --apply  — удалить
 */

import { PrismaClient } from "@prisma/client"
import { FUEL_TARGET_REGIONS } from "../src/lib/fuel-target-regions.ts"
import { isInsideRegion, isVanishedFromSource, PRUNABLE_FUEL_SOURCES, shouldPruneRegion } from "../src/lib/fuel-station-freshness.ts"

const prisma = new PrismaClient()
const apply = process.argv.includes("--apply")
const now = new Date()
const DAY = 24 * 60 * 60_000

/* Контрольный город жалобы: Уфа, центр из справочника городов и тот же
   прямоугольник в 32 км, которым карта набирает точки вокруг города. */
const UFA = { latitude: 54.7431, longitude: 55.9678 }
const MAP_RADIUS_KM = 32
const ufaMapBox = {
  lat1: UFA.latitude - MAP_RADIUS_KM / 111,
  lat2: UFA.latitude + MAP_RADIUS_KM / 111,
  lon1: UFA.longitude - MAP_RADIUS_KM / (111 * Math.cos(UFA.latitude * Math.PI / 180)),
  lon2: UFA.longitude + MAP_RADIUS_KM / (111 * Math.cos(UFA.latitude * Math.PI / 180)),
}

/* SQLite не сравнивает кириллицу без учёта регистра, поэтому сеть ищется
   здесь, в JS. */
const isTatneft = (row) => /татнефт|tatneft/.test(`${row.name || ""} ${row.brand || ""}`.toLocaleLowerCase("ru-RU"))

function countBy(rows, keyOf) {
  const out = {}
  for (const row of rows) out[keyOf(row)] = (out[keyOf(row)] || 0) + 1
  return out
}

async function main() {
  const rows = await prisma.fuelStationImport.findMany({
    select: { id: true, source: true, sourceId: true, name: true, brand: true, address: true, city: true, latitude: true, longitude: true, updatedAt: true, _count: { select: { prices: true } } },
  })

  const doomed = new Map()
  const regionReport = []

  for (const source of PRUNABLE_FUEL_SOURCES) {
    const ofSource = rows.filter((row) => row.source === source)
    for (const region of FUEL_TARGET_REGIONS) {
      const inRegion = ofSource.filter((row) => isInsideRegion(row, region))
      if (!inRegion.length) continue
      const fetchedProxy = inRegion.filter((row) => now.getTime() - row.updatedAt.getTime() < DAY).length
      const vanished = inRegion.filter((row) => isVanishedFromSource(row, region, now))
      const allowed = shouldPruneRegion({ source, fetched: fetchedProxy, vanished: vanished.length, total: inRegion.length })
      if (vanished.length) regionReport.push({ source, region: region.key, total: inRegion.length, fresh: fetchedProxy, vanished: vanished.length, allowed })
      if (allowed) for (const row of vanished) doomed.set(row.id, row)
    }
  }

  const doomedRows = [...doomed.values()]
  const after = rows.filter((row) => !doomed.has(row.id))

  console.log(apply ? "— УДАЛЕНИЕ —" : "— ПРОБНЫЙ ПРОГОН, ничего не удалено —")
  console.log("\nРегионы с пропавшими точками (источник | регион | всего | свежих за сутки | пропавших | чистим?):")
  for (const line of regionReport) {
    console.log(`  ${line.source} | ${line.region} | ${line.total} | ${line.fresh} | ${line.vanished} | ${line.allowed ? "да" : "нет"}`)
  }

  console.log(`\nВсего точек: ${rows.length} → ${after.length} (удаляется ${doomedRows.length}, из них с ценами ${doomedRows.filter((row) => row._count.prices > 0).length})`)
  console.log("По источникам:", JSON.stringify(countBy(doomedRows, (row) => row.source)))

  const ufaCity = (list) => list.filter((row) => row.city === "Уфа")
  const ufaMap = (list) => list.filter((row) => isInsideRegion(row, ufaMapBox))
  console.log(`\nУфа, поле city: ${ufaCity(rows).length} → ${ufaCity(after).length}; «Татнефть»: ${ufaCity(rows).filter(isTatneft).length} → ${ufaCity(after).filter(isTatneft).length}`)
  console.log(`Уфа, окно карты ${MAP_RADIUS_KM} км: ${ufaMap(rows).length} → ${ufaMap(after).length}; «Татнефть»: ${ufaMap(rows).filter(isTatneft).length} → ${ufaMap(after).filter(isTatneft).length}`)
  console.log(`«Татнефть» по всей базе: ${rows.filter(isTatneft).length} → ${after.filter(isTatneft).length}`)

  const ufaDoomed = ufaMap(doomedRows)
  if (ufaDoomed.length) {
    console.log("\nУдаляемые точки в окне карты Уфы:")
    for (const row of ufaDoomed) {
      console.log(`  ${row.source} ${row.sourceId} | ${row.brand || row.name || "—"} | ${row.address || "без адреса"} | последний раз ${row.updatedAt.toISOString().slice(0, 10)} | цен ${row._count.prices}`)
    }
  }

  if (apply && doomedRows.length) {
    const ids = doomedRows.map((row) => row.id)
    let removed = 0
    /* Пачками по пятьсот: SQLite ограничивает число значений в условии.
       Цены уходят каскадом связи. */
    for (let offset = 0; offset < ids.length; offset += 500) {
      const result = await prisma.fuelStationImport.deleteMany({ where: { id: { in: ids.slice(offset, offset + 500) } } })
      removed += result.count
    }
    console.log(`\nУдалено точек: ${removed}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
