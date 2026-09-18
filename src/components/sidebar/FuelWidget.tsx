"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { Box, Text } from "@mantine/core"
import { fetchJson } from "@/lib/api-client"
import { CITY_COORDINATES } from "@/lib/cities"
import { formatFuelKopecks } from "@/lib/fuel-price-format"
import { toCitySlug } from "@/lib/fuel-city-slug"
import type { NetworkPriceRow } from "@/lib/fuel-network-prices"

/**
 * Цены на заправках в правой колонке.
 *
 * Самые сильные данные площадки после аукционов: 37 778 станций и цены
 * по сетям. Человек заходит за машиной, но заправляется каждую неделю —
 * это повод вернуться на сайт между покупками.
 *
 * Город берётся тот же, что на карте АЗС: выбрал Уфу там — видит Уфу
 * здесь. Один ключ хранения на весь сайт, иначе числа разойдутся.
 */

type NetworkPricesResponse = {
  city: string | null
  fuel: string
  networks: NetworkPriceRow[]
}

const CITY_STORAGE_KEY = "lewheel:fuel-city"

/* Четыре сети: столько влезает в колонку 300 пикселей, не превращая
   виджет в простыню. Читают ради первой строки — самой дешёвой. */
const VISIBLE = 4

export default function FuelWidget() {
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

  /* Одна сеть — это не сравнение цен, а реклама одной заправки.
     Меньше двух строк виджета нет. */
  if (!city || networks.length < 2) return null

  const totalStations = networks.reduce((sum, network) => sum + (network.stations ?? 0), 0)

  return (
    <Box component="section" className="side-widget" aria-label="Цены на топливо">
      <Box className="side-widget__head">
        <Text component="h2" className="side-widget__title">Бензин АИ-95</Text>
        <Text className="side-widget__meta">{city}</Text>
      </Box>

      <Box className="side-widget__body">
        {networks.map((network) => (
          <Box key={network.label} className="fuel-row">
            {/* Фирменный цвет сети приходит с сервера вместе с ценой:
                глаз узнаёт «Лукойл» по красному раньше, чем читает
                подпись. Цвет текста тоже с сервера — на жёлтом фоне
                Роснефти белые буквы не читались бы. */}
            <span
              className="fuel-row__mark"
              style={{ backgroundColor: network.color, color: network.textColor }}
              aria-hidden="true"
            >
              {network.shortLabel}
            </span>
            <span className="fuel-row__name">{network.label}</span>
            <span className="fuel-row__price">{formatFuelKopecks(network.priceRub)} ₽</span>
          </Box>
        ))}
      </Box>

      <Link href={`/services/fuel-map/${toCitySlug(city)}`} className="side-widget__link">
        Все заправки на карте
      </Link>

      {/* Сколько станций стоит за этими ценами: без числа «71,35» —
          это чья-то одна колонка, с числом — сводка по 425 точкам. */}
      {totalStations > 0 && (
        {/* «Цены с N станций», а не «по данным N станций»: число считает
            только показанные четыре сети, и формулировка «по данным»
            читалась бы как охват всей базы. */}
        <Text className="side-widget__source">
          Цены с {totalStations.toLocaleString("ru-RU")} станций этих сетей
        </Text>
      )}
    </Box>
  )
}
