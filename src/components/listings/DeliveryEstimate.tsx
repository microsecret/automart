"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Box, Select, Text } from "@mantine/core"
import { CITY_COORDINATES } from "@/lib/cities"
import { estimateRfDelivery, isKnownDeliveryPrice } from "@/lib/rf-delivery"
import { formatPriceShort } from "@/lib/format"

/**
 * Сколько будет стоить доставка машины в город покупателя.
 *
 * Правая колонка карточки обрывалась через тысячу пикселей: ниже неё до
 * конца страницы пустовала треть ширины экрана. Место отдано вопросу,
 * который возникает сразу после цены, — «а сколько ещё за доставку».
 * Раньше за ответом надо было уходить в отдельный калькулятор.
 *
 * Город запоминается: человек смотрит десяток машин подряд, и выбирать
 * его в каждой карточке заново — работа, которую площадка должна делать
 * за него.
 */

const CITY_STORAGE_KEY = "lewheel:delivery-city"

/* Города берутся из общего справочника координат — того же, по которому
   считается расстояние. Иначе в списке оказался бы город, для которого
   расчёт не работает. */
const CITIES = Object.keys(CITY_COORDINATES).sort((a, b) => a.localeCompare(b, "ru"))

export default function DeliveryEstimate({ sellerCity }: { sellerCity: string | null }) {
  const [city, setCity] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CITY_STORAGE_KEY)
      setCity(saved && CITY_COORDINATES[saved] ? saved : "Москва")
    } catch {
      setCity("Москва")
    }
  }, [])

  const choose = (value: string | null) => {
    if (!value) return
    setCity(value)
    try {
      window.localStorage.setItem(CITY_STORAGE_KEY, value)
    } catch {
      /* Приватный режим браузера запрещает запись — выбор просто не
         переживёт перезагрузку, и это не повод ломать расчёт. */
    }
  }

  if (!city) return null

  const price = estimateRfDelivery(city)
  const exact = isKnownDeliveryPrice(city)

  /* Машина уже в городе покупателя — везти нечего. */
  const sameCity = sellerCity && sellerCity === city

  return (
    <Box className="delivery-estimate">
      <Text component="h3" className="delivery-estimate__title">Доставка в ваш город</Text>

      <Select
        data={CITIES}
        value={city}
        onChange={choose}
        searchable
        allowDeselect={false}
        size="xs"
        comboboxProps={{ withinPortal: true }}
        aria-label="Город доставки"
        className="delivery-estimate__city"
      />

      {sameCity ? (
        <Text className="delivery-estimate__same">Машина уже в вашем городе — доставка не нужна.</Text>
      ) : (
        <>
          <Box className="delivery-estimate__row">
            <span className="delivery-estimate__route">
              {sellerCity ? `${sellerCity} → ${city}` : `До города ${city}`}
            </span>
            <span className="delivery-estimate__price">{formatPriceShort(price)}</span>
          </Box>

          {/* Точная цена перевозчика и расчёт по расстоянию — разные вещи,
              и человек должен понимать, что перед ним. Обещать «ровно
              столько» там, где число выведено формулой, значит обмануть
              на этапе, когда он уже считает бюджет. */}
          <Text className="delivery-estimate__note">
            {exact
              ? "Тариф перевозчика · автовоз, страховка включена"
              : "Оценка по расстоянию · точную цену назовёт перевозчик"}
          </Text>
        </>
      )}

      <Link href="/dashboard/deliveries" className="delivery-estimate__link">
        Как устроена доставка
      </Link>
    </Box>
  )
}
