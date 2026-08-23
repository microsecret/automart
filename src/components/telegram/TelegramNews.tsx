"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Box, Loader, Stack, Text } from "@mantine/core"
import { IconEye, IconMessageCircle2, IconNews } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { newsHref } from "@/lib/news"

/**
 * Новости авторынка в приложении.
 *
 * Пока объявлений немного, новости — то, ради чего человек открывает
 * приложение второй раз. Без них он заходит однажды, видит десяток машин
 * и больше не возвращается.
 */

type NewsItem = {
  id: string
  slug: string | null
  title: string
  excerpt: string | null
  imageUrl: string | null
  publishedAt: string | null
  sourceChannel: string | null
  views: number
  _count?: { comments: number }
}

type NewsResponse = { news: NewsItem[] }

export default function TelegramNews() {
  const { data, isLoading } = useSWR<NewsResponse>("/api/news?limit=20", fetchJson, {
    revalidateOnFocus: false,
  })

  if (isLoading) {
    return (
      <Stack align="center" py={48} gap="xs">
        <Loader size="sm" color="var(--tg-accent)" />
        <Text size="xs" c="var(--tg-hint)">Загружаем новости…</Text>
      </Stack>
    )
  }

  const news = data?.news || []
  if (!news.length) {
    return (
      <Stack align="center" py={48} gap={6}>
        <Text fw={700} c="var(--tg-text)">Новостей пока нет</Text>
        <Text size="xs" c="var(--tg-hint)" ta="center" maw={260}>
          Лента обновляется каждый день — загляните позже.
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="var(--tg-card-gap)" pb={8}>
      {news.map((item) => (
        <NewsCard key={item.id} item={item} />
      ))}
    </Stack>
  )
}

function NewsCard({ item }: { item: NewsItem }) {
  const [failed, setFailed] = useState(false)
  const tap = () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")

  /* Дата словами: «сегодня» и «вчера» человек считывает быстрее, чем
     «23 августа», а для новостей свежесть — половина ценности. */
  const published = item.publishedAt ? relativeDay(item.publishedAt) : null

  return (
    <Box component={Link} href={`${newsHref(item)}?from=telegram`} onClick={tap} className="tg-card tg-card--news">
      {item.imageUrl && !failed ? (
        <Box className="tg-card__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        </Box>
      ) : (
        <Box className="tg-card__media tg-card__media--flat">
          <Box className="tg-card__media-empty"><IconNews size={22} /></Box>
        </Box>
      )}

      <Box className="tg-card__body">
        <Text className="tg-card__news-title" lineClamp={3}>{item.title}</Text>
        {item.excerpt && <Text className="tg-card__news-summary" lineClamp={2}>{item.excerpt}</Text>}
        <Box className="tg-card__news-meta">
          <span>{[published, item.sourceChannel].filter(Boolean).join(" · ")}</span>
          {/* Нули не показываем: «0 просмотров» под свежей заметкой
              выглядит хуже, чем отсутствие цифры вовсе. */}
          {item.views > 0 && (
            <span className="tg-card__stat"><IconEye size={12} />{item.views}</span>
          )}
          {(item._count?.comments || 0) > 0 && (
            <span className="tg-card__stat"><IconMessageCircle2 size={12} />{item._count?.comments}</span>
          )}
        </Box>
      </Box>
    </Box>
  )
}

function relativeDay(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return "сегодня"
  if (days === 1) return "вчера"
  if (days < 7) return `${days} дн. назад`
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
}
