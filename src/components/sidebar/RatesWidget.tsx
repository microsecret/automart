"use client"

import useSWR from "swr"
import { Box, Text } from "@mantine/core"
import { fetchJson } from "@/lib/api-client"

/**
 * Курсы валют ЦБ в правой колонке.
 *
 * Не украшение: на площадке восемь тысяч лотов из Японии, Кореи и Китая,
 * и цена каждого считается через курс. Человек, который смотрит лот за
 * 3 200 000 иен, первым делом хочет знать, сколько это в рублях.
 *
 * Показываем только те валюты, которыми торгуются лоты, — иначе список
 * превращается в табло обменника, где нужную строку надо искать.
 */

type Rate = { rateToRub: number; source: string; updatedAt: string }
type RatesResponse = {
  rates: Record<string, Rate>
  asOf: string | null
  stale: boolean
}

/* Порядок — по тому, сколько лотов приходит из страны: Корея 4970,
   Япония 3422, Китай 226. Доллар и евро идут первыми: по ним считают
   растаможку и сравнивают цены, даже когда машина корейская. */
const ORDER = ["USD", "EUR", "CNY", "JPY", "KRW"] as const

const LABELS: Record<string, string> = {
  USD: "Доллар",
  EUR: "Евро",
  CNY: "Юань",
  JPY: "Иена",
  KRW: "Вона",
}

/* Иена и вона стоят копейки за единицу: 0,54 ₽ и 0,062 ₽. Курс за одну
   единицу показывал бы «0,06», и разница между вчера и сегодня
   терялась бы в округлении. Биржи в таких случаях дают курс за сотню —
   так и читается привычнее. */
const PER_HUNDRED = new Set(["JPY", "KRW"])

function formatRate(code: string, value: number): string {
  const perUnit = PER_HUNDRED.has(code) ? value * 100 : value
  return perUnit.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function RatesWidget() {
  const { data } = useSWR<RatesResponse>("/api/exchange-rates", fetchJson, {
    /* Курс ЦБ меняется раз в сутки: перезапрашивать его при каждом
       возврате на вкладку незачем. */
    revalidateOnFocus: false,
    refreshInterval: 30 * 60 * 1000,
  })

  /* Тип code берётся из самого ORDER, а не пишется как string: список
     валют объявлен через `as const`, и предикат с широким string не
     сходится с узким литеральным типом элементов. */
  type CurrencyCode = (typeof ORDER)[number]

  const rows = ORDER.map((code) => ({ code, rate: data?.rates?.[code] })).filter(
    (row): row is { code: CurrencyCode; rate: Rate } => Boolean(row.rate),
  )

  /* Меньше двух курсов — это не сводка, а одинокое число: блока нет.
     Так же поступает витрина АЗС, и по той же причине. */
  if (rows.length < 2) return null

  return (
    <Box component="section" className="side-widget" data-tone="rates" aria-label="Курсы валют">
      <Box className="side-widget__head">
        <Text component="h2" className="side-widget__title">Курсы ЦБ</Text>
      </Box>

      <Box className="side-widget__body">
        {rows.map(({ code, rate }) => (
          <Box key={code} className="rates-row">
            <span className="rates-row__code">{code}</span>
            <span className="rates-row__label">
              {PER_HUNDRED.has(code) ? `100 ${LABELS[code].toLowerCase()}` : LABELS[code]}
            </span>
            <span className="rates-row__value">{formatRate(code, rate.rateToRub)} ₽</span>
          </Box>
        ))}
      </Box>

      {/* Источник и свежесть — под цифрами, мелко.

          Приём подсмотрен у площадки RawMart и ровно отвечает правилу
          «никаких выдуманных сигналов»: число показано, но рядом сказано,
          откуда оно и насколько устарело. Человек сам решает, верить ли. */}
      <Text className="side-widget__source">
        {data?.stale ? "ЦБ РФ · данные устарели" : "ЦБ РФ · официальный курс"}
      </Text>
    </Box>
  )
}
