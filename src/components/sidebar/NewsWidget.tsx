"use client"

import Link from "next/link"
import useSWR from "swr"
import { Box, Text } from "@mantine/core"
import { fetchJson } from "@/lib/api-client"

/**
 * Новости рынка в правой колонке.
 *
 * За сутки приходит около сорока новостей из полутора тысяч — лента
 * живёт сама. В колонке только заголовки и время: картинки и врезки
 * здесь заняли бы место, которого нет, а читают такой блок по одной
 * зацепившей строке.
 */

type NewsItem = {
  id: string
  slug: string
  title: string
  publishedAt: string | null
}

type NewsResponse = { news?: NewsItem[] }

const VISIBLE = 5

/**
 * Насколько давно вышла новость.
 *
 * «43 минуты назад» говорит о свежести ленты больше, чем дата: человек
 * видит, что площадка живая прямо сейчас. Для всего, что старше суток,
 * возвращаем дату — «вчера в 14:30» читается хуже, чем «17 сентября».
 */
function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (!Number.isFinite(minutes) || minutes < 0) return ""
  if (minutes < 1) return "только что"
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
}

export default function NewsWidget() {
  const { data } = useSWR<NewsResponse>(`/api/news?limit=${VISIBLE}&sort=recent`, fetchJson, {
    revalidateOnFocus: false,
  })

  const news = (data?.news ?? []).slice(0, VISIBLE)

  if (news.length < 3) return null

  return (
    <Box component="section" className="side-widget" data-tone="news" aria-label="Новости рынка">
      <Box className="side-widget__head">
        <Text component="h2" className="side-widget__title">Новости рынка</Text>
        <Link href="/news" className="side-widget__all">Все</Link>
      </Box>

      <Box className="side-widget__body">
        {news.map((item) => (
          <Link key={item.id} href={`/news/${item.slug}`} className="news-row">
            <span className="news-row__title">{item.title}</span>
            {timeAgo(item.publishedAt) && (
              <span className="news-row__time">{timeAgo(item.publishedAt)}</span>
            )}
          </Link>
        ))}
      </Box>
    </Box>
  )
}
