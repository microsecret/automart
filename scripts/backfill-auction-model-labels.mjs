#!/usr/bin/env node

// Нормализация модели применяется на импорте, поэтому уже сохранённые лоты
// сохраняют конфигурацию в поле модели: «C-Class 2024 1.5T задний привод
// Sport экостандарт China VI». Скрипт приводит существующие записи к тому же
// виду, что и новые, без повторного обхода источников.
//
// Запуск: node scripts/backfill-auction-model-labels.mjs [--dry-run]

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const dryRun = process.argv.includes("--dry-run")

// Правило намеренно совпадает с `normalizeAuctionModel` в
// `src/lib/auction-normalization.ts`: скрипт запускается без сборки, поэтому
// импортировать TS-модуль здесь нельзя. При изменении правила правьте оба
// места — расхождение проверяется тестом auction-model-normalization.
const MODEL_DESCRIPTIVE_TAIL = /\s(?:АКПП|МКПП|задний привод|передний привод|полный привод|экостандарт|рестайлинг|пакет\s|юбилейная|комплектация|China\s+[IVX]+)/i
const MODEL_MAX_LENGTH = 64

function trimModelConfiguration(model) {
  const cutAt = model.search(MODEL_DESCRIPTIVE_TAIL)
  const trimmed = (cutAt > 0 ? model.slice(0, cutAt) : model).replace(/[\s,;]+$/, "").trim()
  if (!trimmed) return model
  if (trimmed.length <= MODEL_MAX_LENGTH) return trimmed
  const clipped = trimmed.slice(0, MODEL_MAX_LENGTH)
  const lastSpace = clipped.lastIndexOf(" ")
  return (lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped).trim()
}

async function main() {
  const listings = await prisma.auctionListing.findMany({ select: { id: true, model: true } })
  const updates = []

  for (const listing of listings) {
    if (typeof listing.model !== "string" || !listing.model.trim()) continue
    const next = trimModelConfiguration(listing.model.replace(/\s+/g, " ").trim())
    if (next && next !== listing.model) updates.push({ id: listing.id, from: listing.model, to: next })
  }

  console.log(`[model-backfill] ${updates.length} of ${listings.length} listings need a shorter label`)
  for (const update of updates.slice(0, 15)) console.log(`  ${update.from}  →  ${update.to}`)
  if (updates.length > 15) console.log(`  … and ${updates.length - 15} more`)

  if (dryRun) {
    console.log("[model-backfill] dry run: nothing written")
    return
  }

  let updated = 0
  for (const update of updates) {
    await prisma.auctionListing.update({ where: { id: update.id }, data: { model: update.to } })
    updated += 1
  }
  console.log(`[model-backfill] updated ${updated} listings`)
}

main()
  .catch((error) => {
    console.error("[model-backfill] failed:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
