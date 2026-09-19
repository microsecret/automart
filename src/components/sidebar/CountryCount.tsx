"use client"

import useSWR from "swr"
import { fetchJson } from "@/lib/api-client"

/**
 * Число лотов страны рядом с пунктом меню.
 *
 * В боковой колонке пять стран шли без единой цифры: узнать, что в
 * Корее пять тысяч машин, а в США ни одной, можно было только зайдя в
 * каждую. Число отвечает на это до перехода.
 *
 * Данные те же, что в статистике площадки: один запрос, который SWR
 * склеивает для всех пяти счётчиков разом.
 */

type StatsResponse = {
  auctionByCountry?: Record<string, number>
}

/* Ниже двух лотов счётчик молчит — как и у направлений транспорта.
   «США 1» сообщает не о наполнении раздела, а о его пустоте. */
const MIN_VISIBLE = 2

export default function CountryCount({ code }: { code: string }) {
  const { data } = useSWR<StatsResponse>("/api/stats", fetchJson, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const value = data?.auctionByCountry?.[code]

  if (typeof value !== "number" || value < MIN_VISIBLE) return null

  return (
    <span className="nav-count" aria-hidden="true">
      {value.toLocaleString("ru-RU")}
    </span>
  )
}
