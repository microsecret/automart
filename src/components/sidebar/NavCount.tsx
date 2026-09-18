"use client"

import useSWR from "swr"
import { fetchJson } from "@/lib/api-client"

/**
 * Счётчик рядом с пунктом меню.
 *
 * Плотная навигация тем и хороша, что отвечает на вопрос «где что есть»
 * до перехода: человек видит, что в аукционах восемь тысяч машин, а в
 * спецтехнике пусто, и не тратит клик на проверку.
 *
 * Замер базы: легковые 37, мото 1, грузовики 1, спецтехника 0, водный 0,
 * воздушный 0, запчасти 0. Половина направлений пуста — и это как раз
 * причина не печатать ноль. «Спецтехника 0» сообщает, что раздел мёртв;
 * «Спецтехника» без числа просто приглашает заглянуть. Врать при этом не
 * приходится: пустого числа нет, а не показано ложное.
 *
 * Единица тоже молчит: «Мото 1» выглядит не сводкой, а признанием, что
 * раздел держится на одном объявлении. Порог — от двух.
 */

type CountsResponse = { counts?: Record<string, number> }

/* Ниже этого числа счётчик не показывается: одна-две записи в разделе
   не «наполнение», а случайность. */
const MIN_VISIBLE = 2

export default function NavCount({ category }: { category: string }) {
  const { data } = useSWR<CountsResponse>("/api/listings/counts", fetchJson, {
    revalidateOnFocus: false,
    /* Один запрос на весь сайт: SWR склеивает одинаковые ключи, поэтому
       шесть счётчиков в меню не дают шести обращений к серверу. */
    dedupingInterval: 60_000,
  })

  const value = data?.counts?.[category]

  if (typeof value !== "number" || value < MIN_VISIBLE) return null

  return (
    <span className="nav-count" aria-hidden="true">
      {value.toLocaleString("ru-RU")}
    </span>
  )
}
