"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { Box, Text } from "@mantine/core"
import { IconArrowRight } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { CITY_COORDINATES } from "@/lib/cities"
import { formatFuelKopecks } from "@/lib/fuel-price-format"
import { toCitySlug } from "@/lib/fuel-city-slug"
import type { NetworkPriceRow } from "@/lib/fuel-network-prices"

/**
 * Карточка «Где заправиться» в первом экране — по макету площадки.
 *
 * В макете справа в герое стоит блок с ценами на топливо и мини-картой.
 * Здесь был «Маршрут сделки» — три строки о том, как устроена покупка с
 * аукциона. Текст о процессе занимал место, на котором в макете живые
 * цифры, и на первом экране рассказывал о себе вместо того, чтобы
 * приносить пользу.
 *
 * Цены те же, что в витрине ниже и в сводке для чатов: один расчёт на
 * весь сайт, иначе числа разойдутся.
 */

type NetworkPricesResponse = {
  city: string | null
  fuel: string
  networks: NetworkPriceRow[]
}

/* Тот же ключ, что у карты АЗС и витрины ниже: человек выбрал там Уфу —
   первый экран обязан показать Уфу. */
const CITY_STORAGE_KEY = "lewheel:fuel-city"

/* Три строки: в герое место ограничено высотой фотографии, а список
   читают ради первой — самой дешёвой сети. */
const VISIBLE = 3

export default function HeroFuelCard() {
  const [city, setCity] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CITY_STORAGE_KEY)
      setCity(saved && CITY_COORDINATES[saved] ? saved : "Москва")
    } catch {
      setCity("Москва")
    }
  }, [])

  const { data } = useSWR<NetworkPricesResponse>(
    city ? `/api/fuel-network-prices?city=${encodeURIComponent(city)}&fuel=AI95` : null,
    fetchJson,
    { revalidateOnFocus: false },
  )

  const networks = (data?.networks ?? []).slice(0, VISIBLE)

  /* Пока сравнивать не с чем, карточки нет: одна строка о цене — это не
     сводка, а реклама одной сети. Герой в таком случае остаётся с
     фотографией во всю ширину, и это не выглядит поломкой. */
  if (!city || networks.length < 2) return null

  return (
    <Box className="hero-fuel">
      <Box className="hero-fuel__head">
        <Text className="hero-fuel__title">Где заправиться</Text>
        <Text className="hero-fuel__city">{city} · АИ-95</Text>
      </Box>

      <Box className="hero-fuel__list">
        {networks.map((network) => (
          <Box key={network.label} className="hero-fuel__row">
            <span
              className="hero-fuel__mark"
              style={{ backgroundColor: network.color, color: network.textColor }}
              aria-hidden="true"
            >
              {network.shortLabel}
            </span>
            <Text className="hero-fuel__network">{network.label}</Text>
            <Text className="hero-fuel__price">{formatFuelKopecks(network.priceRub)} ₽</Text>
          </Box>
        ))}
      </Box>

      <Link href={`/services/fuel-map/${toCitySlug(city)}`} className="hero-fuel__link">
        Показать на карте
        <IconArrowRight size={15} />
      </Link>
    </Box>
  )
}
