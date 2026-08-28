/**
 * Свои снимки для отправки в Telegram — байтами, а не ссылкой.
 *
 * Ссылку на наши картинки Telegram не берёт: на `https://lewheel.ru/
 * uploads/...` он отвечает «failed to get HTTP URL content», хотя файл
 * открывается и браузером, и curl (200, 645 КБ), а сторонние картинки
 * уходят. Вероятная причина в сертификате: он подписан корнем ISRG Root
 * X2 на эллиптических кривых, который серверы Telegram могут не знать.
 *
 * Проверено на продакшене: та же фотография ссылкой даёт ошибку, телом
 * запроса уходит.
 *
 * Модуль общий: этим чтением пользуются и бесплатная публикация
 * объявления, и платное продвижение — держать его в двух местах значит
 * однажды поправить одно и забыть про другое.
 */

import { readFile } from "node:fs/promises"
import path from "node:path"

/**
 * Читает свои снимки с диска, чтобы отправить их байтами.
 *
 * Ссылку на наши картинки Telegram не берёт: на `https://lewheel.ru/
 * uploads/...` он отвечает «failed to get HTTP URL content», хотя файл
 * открывается и браузером, и curl, а сторонние картинки уходят. Все
 * десять объявлений площадки не попали бы в чаты вовсе.
 *
 * Читаются только пути внутри /uploads: адрес приходит из базы, и
 * запрос вида «/uploads/../../etc/passwd» не должен превращаться в
 * чтение чужого файла. Внешние адреса остаются ссылками — их Telegram
 * забирает сам.
 */
export async function readLocalPhotos(photos: string[]): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>()
  const root = path.join(process.cwd(), "public", "uploads")

  for (const photo of photos) {
    if (!photo.startsWith("/uploads/")) continue

    const name = photo.slice("/uploads/".length)
    /* Имя файла и ничего больше: ни каталогов, ни переходов вверх. */
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes("..")) continue

    try {
      files.set(photo, await readFile(path.join(root, name)))
    } catch {
      /* Файла нет на диске — снимок уйдёт ссылкой и, скорее всего, не
         дойдёт; это лучше, чем потерять весь пост. */
    }
  }

  return files
}

/** Вид вложения по расширению: Telegram смотрит на имя файла. */
export function photoMime(name: string): string {
  if (/\.png$/i.test(name)) return "image/png"
  if (/\.webp$/i.test(name)) return "image/webp"
  return "image/jpeg"
}

