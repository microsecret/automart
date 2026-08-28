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
 * Ряды должны заполняться целиком: три плитки по две в ряд оставляли бы
 * вторую строку из одной плитки, прижатой влево, и половину ширины
 * пустой — это читается как сбой вёрстки, а не как раскладка.
 *
 * Поэтому число в ряду подбирается делителем: три снимка идут по три,
 * четыре — по два, шесть — по три. Когда ровного деления нет (пять,
 * семь), берём то, при котором последний ряд полнее.
 *
 * Больше трёх в ряд не ставим: машина на плитке шириной в четверть
 * перестаёт читаться.
 */
function rowSize(rest: number): number {
  if (rest <= 3) return rest

  /* Ровное деление — лучший случай: ни одного полупустого ряда. */
  for (const size of [3, 2]) {
    if (rest % size === 0) return size
  }

  /* Ровного нет: берём то, при котором последний ряд полнее. Ноль
     означает ровное деление и сюда не попадает, поэтому сравниваем
     остатки напрямую. */
  return rest % 3 >= rest % 2 ? 3 : 2
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

      /* Плитки неполного ряда растягиваются на свободное место: одна
         плитка шириной в треть, прижатая влево, с пустотой справа
         читается как сбой вёрстки, а не как раскладка. */
      const inThisRow = Math.min(perRow, rest - row * perRow)
      const width = Math.floor((WIDTH - GAP * (inThisRow - 1)) / inThisRow)

      const tile = await sharp(items[i + 1].data)
        .resize(width, cellHeight, { fit: "cover", position: "attention" })
        .toBuffer()

      layers.push({
        input: tile,
        top: heroHeight + GAP + row * (cellHeight + GAP),
        left: col * (width + GAP),
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
