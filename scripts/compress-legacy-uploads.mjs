/**
 * Разовое сжатие фотографий, загруженных до появления обработки.
 *
 * Сжатие при загрузке появилось 20 августа 2026 (`src/app/api/upload/route.ts`:
 * sharp уменьшает до 1920 по длинной стороне и жмёт с качеством 82). Файлы,
 * загруженные раньше, остались оригиналами с телефонов: замер нашёл 22 штуки
 * по 4032×3024 общим весом 65.7 МБ из 175 МБ всей папки.
 *
 * Показываются они в карточке шириной 200–300 пикселей, то есть в двадцать
 * раз меньше своего разрешения. На телефоне каталог из-за них весил 3 МБ.
 *
 * Оптимизатор Next до этих файлов не добирается: он составляет список
 * public при сборке, и загруженное позже для него не существует
 * (см. `src/lib/uploaded-image.ts`). Поэтому сжимать надо сами файлы.
 *
 * Запуск на сервере:
 *   node scripts/compress-legacy-uploads.mjs           — показать, что будет
 *   node scripts/compress-legacy-uploads.mjs --apply   — сжать
 *
 * Имена файлов не меняются: на них ссылаются записи в базе.
 */
import { readdir, stat, rename, unlink, copyFile } from "node:fs/promises"
import { join } from "node:path"
import sharp from "sharp"

const DIR = process.env.UPLOADS_DIR || "/root/AutoMart/public/uploads"
const APPLY = process.argv.includes("--apply")

/* Те же значения, что и при загрузке: иначе старые и новые фотографии
   будут отличаться по качеству в одной ленте. */
const MAX_SIDE = 1920
const QUALITY = 82

/* Порог: ниже него сжатие не окупается. Файл на 300 КБ при ширине 1920
   уже в порядке, и перепаковка только потеряет качество. */
const MIN_KB = 400

const files = await readdir(DIR)
const plan = []

for (const name of files) {
  if (!/\.(jpe?g|png)$/i.test(name)) continue
  const path = join(DIR, name)
  let info
  try {
    info = await stat(path)
  } catch { continue }
  if (info.size < MIN_KB * 1024) continue

  let meta
  try {
    meta = await sharp(path).metadata()
  } catch (error) {
    console.log(`  ! ${name}: не читается (${String(error.message).slice(0, 60)})`)
    continue
  }

  const longest = Math.max(meta.width || 0, meta.height || 0)
  if (longest <= MAX_SIDE && info.size < 700 * 1024) continue

  plan.push({ name, path, kb: Math.round(info.size / 1024), w: meta.width, h: meta.height })
}

plan.sort((a, b) => b.kb - a.kb)

console.log(`кандидатов: ${plan.length}, вес ${(plan.reduce((s, f) => s + f.kb, 0) / 1024).toFixed(1)} МБ`)
if (!plan.length) process.exit(0)

if (!APPLY) {
  for (const f of plan.slice(0, 30)) {
    console.log(`  ${String(f.kb).padStart(5)} КБ  ${f.w}x${f.h}  ${f.name}`)
  }
  console.log("\nчтобы сжать: node scripts/compress-legacy-uploads.mjs --apply")
  process.exit(0)
}

let savedKb = 0
let done = 0
let failed = 0

for (const f of plan) {
  const tmp = `${f.path}.tmp`
  const backup = `${f.path}.orig`
  try {
    /* Копия оригинала остаётся рядом до конца прогона: если что-то пойдёт
       не так, фотографию объявления можно вернуть. */
    await copyFile(f.path, backup)

    await sharp(f.path)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toFile(tmp)

    const after = await stat(tmp)
    const afterKb = Math.round(after.size / 1024)

    /* Если сжатие не помогло — оставляем как было. */
    if (afterKb >= f.kb) {
      await unlink(tmp)
      await unlink(backup)
      console.log(`  = ${f.name}: ${f.kb} КБ, сжатие не помогло`)
      continue
    }

    await rename(tmp, f.path)
    await unlink(backup)

    savedKb += f.kb - afterKb
    done++
    console.log(`  ✓ ${f.name}: ${f.kb} → ${afterKb} КБ  (${f.w}x${f.h})`)
  } catch (error) {
    failed++
    console.log(`  ✗ ${f.name}: ${String(error.message).slice(0, 70)}`)
    /* Возвращаем оригинал, если успели его сохранить. */
    try { await rename(backup, f.path) } catch { /* копии нет — файл не тронут */ }
    try { await unlink(tmp) } catch { /* временного файла нет */ }
  }
}

console.log(`\nсжато ${done}, не удалось ${failed}, освобождено ${(savedKb / 1024).toFixed(1)} МБ`)
