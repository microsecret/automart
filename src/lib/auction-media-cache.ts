/**
 * Дисковый кэш пересланных аукционных снимков.
 *
 * Пересылка `/api/auction-media` заведена для источников, которые
 * отдают файлы слишком медленно или с неправильным типом. В её коде
 * было написано, что «файл скачивается один раз, дальше приходит из
 * кэша», — но кэша не существовало: каждый запрос тянул картинку
 * заново.
 *
 * Замер 17 сентября 2026: снимок CarSensor приходит ровно за 40 секунд
 * и первый раз, и второй. Карточка ждёт восемь секунд и показывает
 * «Фото ожидается». Итог — 2571 лот из Японии без единой фотографии, а
 * по фотографии машину и выбирают.
 *
 * Причина медленности известна и записана в самой пересылке: CarSensor
 * режет скорость по адресу сервера, для обхода заведён пул прокси. На
 * 17 сентября все четыре прокси в пуле мертвы — это внешняя услуга, и
 * кодом её не починить. Кэш решает другую половину задачи: сколько бы
 * ни тянулся первый запрос, следующие приходят с диска мгновенно.
 */

import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

/*
 * Кэш лежит рядом со сборкой, а не в /tmp.
 *
 * `/tmp` на сервере чистится, и кэш терялся бы после каждой уборки — то
 * есть ровно тогда, когда он нужнее всего. Папка `.next/cache` уже
 * существует, переживает перезапуск службы и не попадает в git.
 */
const CACHE_DIR = path.join(process.cwd(), ".next", "cache", "auction-media")

/*
 * Потолок кэша.
 *
 * Полтора гигабайта при двенадцати свободных: снимок весит около
 * двадцати килобайт, значит поместится порядка семидесяти тысяч штук —
 * больше, чем лотов в каталоге. Уборка идёт по времени последнего
 * обращения, поэтому вытесняется то, на что никто не смотрит.
 */
const MAX_CACHE_BYTES = 1_500_000_000

/*
 * Как часто проверять размер.
 *
 * Обход папки с десятками тысяч файлов стоит заметного времени, и
 * делать его на каждую запись незачем: кэш растёт медленно.
 */
const SWEEP_INTERVAL_MS = 30 * 60 * 1000

let lastSweepAt = 0

/** Имя файла: хэш адреса, чтобы не зависеть от длины и символов в нём. */
function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex")
}

type CachedMedia = {
  body: Buffer
  contentType: string
}

/*
 * Тип хранится рядом с файлом отдельной строкой.
 *
 * Определять его заново по байтам при каждом чтении можно, но тогда
 * кэш забыл бы то, что пересылка уже выяснила: у beforward тип в
 * заголовке не годится, и он вычисляется по сигнатуре файла.
 */
function metaPath(key: string): string {
  return path.join(CACHE_DIR, `${key}.type`)
}

function bodyPath(key: string): string {
  return path.join(CACHE_DIR, `${key}.bin`)
}

/** Отдаёт снимок из кэша или `null`, если его там нет. */
export async function readCachedMedia(url: string): Promise<CachedMedia | null> {
  const key = cacheKey(url)
  try {
    const [body, contentType] = await Promise.all([
      readFile(bodyPath(key)),
      readFile(metaPath(key), "utf8"),
    ])
    if (!body.byteLength || !contentType) return null
    return { body, contentType: contentType.trim() }
  } catch {
    /* Файла нет, он повреждён или диск недоступен — это не ошибка
       запроса: пересылка просто сходит к источнику. */
    return null
  }
}

/** Кладёт снимок в кэш. Неудача записи не должна ломать выдачу. */
export async function writeCachedMedia(url: string, media: CachedMedia): Promise<void> {
  if (!media.body.byteLength || !media.contentType) return
  const key = cacheKey(url)
  try {
    await mkdir(CACHE_DIR, { recursive: true })
    await Promise.all([
      writeFile(bodyPath(key), media.body),
      writeFile(metaPath(key), media.contentType, "utf8"),
    ])
  } catch {
    /* Диск переполнен или права не те: картинку человек всё равно
       получит, просто медленно. Ронять ответ из-за кэша нельзя. */
    return
  }
  void sweepIfNeeded()
}

/**
 * Убирает самые давние снимки, когда кэш перерос потолок.
 *
 * Выбрасывается то, к чему дольше всего не обращались: популярные лоты
 * остаются, а разовые уходят.
 */
async function sweepIfNeeded(): Promise<void> {
  const now = Date.now()
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return
  lastSweepAt = now

  try {
    const names = await readdir(CACHE_DIR)
    const files = await Promise.all(names.map(async (name) => {
      const full = path.join(CACHE_DIR, name)
      try {
        const info = await stat(full)
        return { full, size: info.size, atime: info.atimeMs }
      } catch {
        return null
      }
    }))

    const present = files.filter((file): file is { full: string; size: number; atime: number } => file !== null)
    const total = present.reduce((sum, file) => sum + file.size, 0)
    if (total <= MAX_CACHE_BYTES) return

    /* Давние — первыми. Удаляем, пока не уложимся в три четверти
       потолка: чистить ровно до края значило бы запускать уборку почти
       на каждой записи. */
    present.sort((first, second) => first.atime - second.atime)
    let freed = 0
    const target = total - MAX_CACHE_BYTES * 0.75
    for (const file of present) {
      if (freed >= target) break
      try {
        await unlink(file.full)
        freed += file.size
      } catch {
        /* Файл уже убрали или он занят — идём дальше. */
      }
    }
  } catch {
    /* Папки ещё нет или она недоступна: это не повод падать. */
  }
}
