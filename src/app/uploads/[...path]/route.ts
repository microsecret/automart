import { readFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"

/**
 * Файлы из public/uploads, появившиеся после сборки.
 *
 * Next в продакшене отдаёт из public только то, что лежало там при сборке.
 * Браузеру /uploads отдаёт nginx напрямую, поэтому прямая ссылка работала
 * всегда. Но оптимизатор картинок запрашивает файл у самого Next — и для
 * снимка, загруженного после деплоя, получал 404 и отвечал «isn't a valid
 * image». Карточка показывала «Фото недоступно» до следующего деплоя.
 * Частые деплои прятали это: после сборки все файлы снова «существовали».
 * Поймано 28.09.2026 на объявлении, загруженном через десять часов после
 * сборки: все семь снимков — 400 от /_next/image, файлы на диске целы.
 *
 * Файлы, бывшие в public при сборке, Next по-прежнему отдаёт сам: этот
 * обработчик получает только то, чего в его списке нет.
 */

// Имена задаёт загрузчик: uuid и расширение. Всё прочее — не наш файл.
const SAFE_NAME = /^[A-Za-z0-9_-]{1,80}\.(jpe?g|png|webp|avif|gif)$/i
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
}
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads")

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params
  // Вложенных папок загрузчик не создаёт: один сегмент — одно имя файла.
  if (segments.length !== 1 || !SAFE_NAME.test(segments[0])) {
    return new NextResponse(null, { status: 404 })
  }
  const name = segments[0]
  try {
    const file = await readFile(path.join(UPLOAD_ROOT, name))
    const extension = name.split(".").pop()!.toLowerCase()
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension],
        // Имя — случайный uuid, содержимое под ним не меняется.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
