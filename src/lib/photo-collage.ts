/**
 * Склейка снимков объявления в одну картинку.
 *
 * Telegram не позволяет прикрепить кнопки к альбому: пост уходил двумя
 * сообщениями — снимки, а под ними оторванная строка с кнопками. В чате
 * это читается как два разных поста.
 *
 * Одна фотография кнопки принимает. Поэтому снимки склеиваются в сетку и
 * уходят единственным изображением — тогда в сообщении есть и все
 * фотографии, и текст, и кнопки.
 *
 * Раскладка выбрана так, чтобы главный снимок остался крупным: он идёт
 * первым и занимает верхнюю половину, остальные выстраиваются под ним
 * рядами. Так человек видит машину целиком, а не девять марок размером
 * с ноготь.
 */

import sharp from "sharp"

/** Больше девяти в сетке — каждый снимок становится неразличимым. */
export const MAX_COLLAGE_PHOTOS = 9

/** Ширина готовой картинки: Telegram показывает её примерно в 800 точек. */
const WIDTH = 1200

/** Зазор между снимками — иначе они сливаются в одно пятно. */
const GAP = 6

/** Цвет зазора: светлый, как фон карточки на сайте. */
const BACKGROUND = { r: 244, g: 244, b: 245, alpha: 1 }

export type CollageInput = { data: Buffer }

/**
 * Сколько снимков ставить в ряд под главным.
 *
 * Два ряда по три — предел, за которым машина на снимке перестаёт
 * читаться. Для меньшего числа ряд короче, и снимки крупнее.
 */
function rowSize(rest: number): number {
  if (rest <= 2) return 2
  if (rest <= 4) return 2
  return 3
}

/**
 * Склеивает снимки в одну картинку.
 *
 * Возвращает null, если склеить нечего или что-то пошло не так: тогда
 * вызывающий отправит первый снимок как есть — это хуже, но рабочее.
 */
export async function buildPhotoCollage(photos: CollageInput[]): Promise<Buffer | null> {
  const items = photos.slice(0, MAX_COLLAGE_PHOTOS)
  if (items.length === 0) return null

  /* Один снимок склеивать незачем — он и так уходит целиком. */
  if (items.length === 1) return null

  try {
    const rest = items.length - 1

    /* Главный снимок во всю ширину: пропорция 3:2 — обычная для
       автомобильной съёмки, и кадр не обрезается по кузову. */
    const heroHeight = Math.round((WIDTH * 2) / 3)

    const perRow = rowSize(rest)
    const cellWidth = Math.floor((WIDTH - GAP * (perRow - 1)) / perRow)
    /* Квадратные плитки: разная высота у соседей рвала бы ряд. */
    const cellHeight = cellWidth
    const rows = Math.ceil(rest / perRow)

    const totalHeight = heroHeight + (rest > 0 ? GAP + rows * cellHeight + GAP * (rows - 1) : 0)

    const hero = await sharp(items[0].data)
      .resize(WIDTH, heroHeight, { fit: "cover", position: "attention" })
      .toBuffer()

    const layers: { input: Buffer; top: number; left: number }[] = [{ input: hero, top: 0, left: 0 }]

    for (let i = 0; i < rest; i += 1) {
      const row = Math.floor(i / perRow)
      const col = i % perRow
      const tile = await sharp(items[i + 1].data)
        .resize(cellWidth, cellHeight, { fit: "cover", position: "attention" })
        .toBuffer()

      layers.push({
        input: tile,
        top: heroHeight + GAP + row * (cellHeight + GAP),
        left: col * (cellWidth + GAP),
      })
    }

    return await sharp({
      create: {
        width: WIDTH,
        height: totalHeight,
        channels: 3,
        background: BACKGROUND,
      },
    })
      .composite(layers)
      /* Качество 82 — то же, что при загрузке: выше даёт вес без
         заметной разницы, ниже мылит номера и салон. */
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
  } catch (error) {
    console.error("Склейка снимков:", error)
    return null
  }
}
