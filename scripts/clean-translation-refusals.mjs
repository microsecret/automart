#!/usr/bin/env node

// В поле «Местонахождение» у сорока четырёх лотов на боевом сайте стояло:
// «Это не автомобильный текст. Пожалуйста, предоставьте текст для перевода.»
//
// Это ответ языковой модели, которой дали короткое название города: она не
// признала его автомобильным текстом и отказалась работать, а отказ
// сохранился как перевод. Прежняя проверка смотрела только на кириллицу —
// отказ написан по-русски и проходил её насквозь. Текст попадал и в
// карточку лота, и в разметку schema.org, то есть в поисковую выдачу.
//
// Защита на импорте добавлена (`src/lib/translation-refusal.ts`), этот
// скрипт чинит уже сохранённое.
//
// Запуск: node scripts/clean-translation-refusals.mjs [--dry-run]

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const dryRun = process.argv.includes("--dry-run")

// Правило намеренно совпадает с `isTranslationRefusal` в
// `src/lib/translation-refusal.ts`: скрипт запускается без сборки, поэтому
// импортировать TS-модуль здесь нельзя. При изменении правила правьте оба
// места — набор образцов проверяется тестом translation-refusal.
const REFUSAL_PATTERNS = [
  /не\s+(?:является\s+)?автомобильн[а-яё]*\s+текст/i,
  /это\s+не\s+автомобильн/i,
  /предостав[а-яё]+\s+текст/i,
  /не\s+(?:могу|может|удалось|получается)\s+перевес/i,
  /перевод\s+(?:невозможен|не\s+требуется)/i,
  /(?:введите|укажите)\s+текст/i,
  /текст\s+для\s+перевода\s+(?:отсутству|пуст|не\s+пред)/i,
  /это\s+(?:корейск|японск|китайск|английск)[а-яё]*\s+текст/i,
  /^(?:извините|прошу\s+прощения|к\s+сожалению)[,.\s]/i,
  /^перевод\s*:/i,
]

// Те же подписи, что и в `IMPORT_COUNTRY_LABELS` (src/lib/auction-import.ts).
const COUNTRY_LABELS = {
  KR: "Корея", CN: "Китай", JP: "Япония", US: "США", DE: "Германия", EU: "Европа", AE: "ОАЭ",
}

function isRefusal(text) {
  const value = text?.trim()
  if (!value) return false
  return REFUSAL_PATTERNS.some((pattern) => pattern.test(value))
}

/* Замена честнее пустоты: «Корея — точный адрес у источника» говорит
   покупателю, откуда машина, и не притворяется, что адрес известен.
   Ровно эту подпись ставит импорт, когда перевод не удался. */
function fallbackLocation(country) {
  const label = COUNTRY_LABELS[country] || country || "Заграница"
  return `${label} — точный адрес у источника`
}

async function main() {
  const listings = await prisma.auctionListing.findMany({
    select: { id: true, location: true, country: true },
  })

  const broken = listings.filter((listing) => isRefusal(listing.location))
  console.log(`Всего лотов: ${listings.length}, с отказом переводчика: ${broken.length}`)

  if (!broken.length) {
    console.log("Чинить нечего.")
    return
  }

  const byCountry = {}
  for (const listing of broken) {
    byCountry[listing.country || "—"] = (byCountry[listing.country || "—"] || 0) + 1
  }
  console.log("По странам:", JSON.stringify(byCountry))
  console.log("Пример:", JSON.stringify(broken[0].location))

  if (dryRun) {
    console.log("Пробный запуск: ничего не изменено.")
    return
  }

  let fixed = 0
  for (const listing of broken) {
    await prisma.auctionListing.update({
      where: { id: listing.id },
      data: { location: fallbackLocation(listing.country) },
    })
    fixed += 1
  }
  console.log(`Исправлено: ${fixed}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
