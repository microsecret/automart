"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { Box, Group, Text } from "@mantine/core"
import { IconArrowRight } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { CITY_COORDINATES } from "@/lib/cities"
import { plural } from "@/lib/format"
import { formatFuelKopecks } from "@/lib/fuel-price-format"
import { toCitySlug } from "@/lib/fuel-city-slug"
import type { NetworkPriceRow } from "@/lib/fuel-network-prices"

/**
 * Где заправиться: цены по сетям АЗС в городе человека.
 *
 * На карте видна цена конкретной заправки, но не картина целиком —
 * дорого ли сегодня и у кого дешевле. Ответ у площадки есть: семьдесят
 * шесть тысяч цен по четырнадцати тысячам точек. Лежал он россыпью по
 * карте, куда заходит меньшинство.
 *
 * Сгруппировано по сетям, потому что водитель выбирает вывеску, а не
 * точку: по карте лояльности, по привычке, по тому, что по дороге.
 * Отсортировано от дешёвой к дорогой — сводку читают ради первой
 * строки.
 */

type NetworkPricesResponse = {
  city: string | null
  fuel: string
  networks: NetworkPriceRow[]
}

/* Тот же ключ, что у карты АЗС: человек выбрал там Уфу — главная обязана
   показать Уфу, иначе он решит, что площадка его не помнит. */
const CITY_STORAGE_KEY = "lewheel:fuel-city"

/* Марки, между которыми переключаются чаще всего. Газ и сотый сюда не
   попали намеренно: их берут единицы, а каждая лишняя кнопка в ряду —
   это меньше места под цену на телефоне. */
const FUELS = [
  { id: "AI92", label: "92" },
  { id: "AI95", label: "95" },
  { id: "DT", label: "ДТ" },
] as const

/* Шесть строк: больше — и витрина начинает соперничать с самой картой,
   ради которой она и стоит на главной. */
const VISIBLE_NETWORKS = 6

export default function FuelShowcase() {
  const [fuel, setFuel] = useState<string>("AI95")
  /* Город читается после монтирования, а не при первом рендере: на
     сервере хранилища нет, и рассинхрон разметки уронил бы гидратацию. */
  const [city, setCity] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CITY_STORAGE_KEY)
      setCity(saved && CITY_COORDINATES[saved] ? saved : "Москва")
    } catch {
      /* Приватное окно или запрет на хранилище — не повод скрывать блок. */
      setCity("Москва")
    }
  }, [])

  const { data, isLoading } = useSWR<NetworkPricesResponse>(
    city ? `/api/fuel-network-prices?city=${encodeURIComponent(city)}&fuel=${fuel}` : null,
    fetchJson,
    {
      /* Цены обновляются обходом раз в несколько часов — перезапрашивать
         их при каждом возврате на вкладку незачем. */
      revalidateOnFocus: false,
      /* Прежние цены остаются на экране, пока грузятся новые: при смене
         марки список иначе схлопывается в пустоту и прыгает обратно. */
      keepPreviousData: true,
    },
  )

  const networks = (data?.networks ?? []).slice(0, VISIBLE_NETWORKS)

  /* Пока город не прочитан или сеть в нём одна, блока нет вовсе: сводка
     из одной строки ничего не сравнивает, а пустая витрина на главной
     говорит, что площадка не работает. */
  if (!city) return null
  if (!isLoading && networks.length < 2) return null

  const cheapest = networks[0]

  return (
    <Box className="fuel-showcase" component="section" aria-label="Цены на топливо по сетям">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="md">
        <Box>
          <Text component="h2">
            Где заправиться
          </Text>
          <Text size="sm" c="dimmed">
            {cheapest
              ? `${city} · дешевле всего ${cheapest.label}`
              : `Цены по сетям · ${city}`}
          </Text>
        </Box>

        <Group gap="xs" wrap="nowrap">
          {/* Переключатель марки. Кнопки, а не вкладки: список ниже не
              меняет назначения, меняются только числа в нём. */}
          <Box className="fuel-showcase__fuels" role="group" aria-label="Марка топлива">
            {FUELS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="fuel-showcase__fuel"
                data-active={item.id === fuel || undefined}
                aria-pressed={item.id === fuel}
                onClick={() => setFuel(item.id)}
              >
                {item.label}
              </button>
            ))}
          </Box>

          <Link href={`/services/fuel-map/${toCitySlug(city)}`} className="fuel-showcase__all">
            На карте
            <IconArrowRight size={15} />
          </Link>
        </Group>
      </Group>

      <Box className="fuel-showcase__grid">
        {networks.map((network, index) => (
          <Box
            key={network.label}
            className="fuel-showcase__card"
            /* Ступенька появления: строки приезжают одним ответом и иначе
               вспыхнули бы разом. Задержка в переменной, а не в классе, —
               количество сетей заранее неизвестно. */
            style={{ "--row-index": index } as React.CSSProperties}
          >
            <Box
              className="fuel-showcase__brand"
              style={{ backgroundColor: network.color, color: network.textColor }}
              aria-hidden="true"
            >
              {network.shortLabel}
            </Box>

            <Box className="fuel-showcase__body">
              <Text className="fuel-showcase__network">{network.label}</Text>
              <Text className="fuel-showcase__stations">
                {network.stations} {plural(network.stations, "заправка", "заправки", "заправок")}
              </Text>
            </Box>

            <Text className="fuel-showcase__price">
              {formatFuelKopecks(network.priceRub)}
              <span className="fuel-showcase__currency"> ₽</span>
            </Text>
          </Box>
        ))}
      </Box>

      {/* Честная оговорка. Цена собрана с источников и отметок водителей,
          между обходами она стареет — обещать точность до копейки на
          колонке площадка не может и не должна. */}
      <Text className="fuel-showcase__note">
        Медиана по сети, обновляется несколько раз в сутки. На колонке цена может отличаться.
      </Text>
    </Box>
  )
}
