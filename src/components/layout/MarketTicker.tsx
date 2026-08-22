"use client"

import useSWR from "swr"
import { fetchJson } from "@/lib/api-client"

type RateEntry = { rateToRub: number; source: string; updatedAt: string | null }
type RatesResponse = { rates?: Record<string, RateEntry> }

/** Валюты в порядке значимости для импорта: Корея и Япония — основные площадки. */
const CURRENCIES: { code: string; label: string; per?: number }[] = [
  { code: "USD", label: "Доллар" },
  { code: "EUR", label: "Евро" },
  { code: "KRW", label: "Вона", per: 100 },
  { code: "JPY", label: "Иена", per: 100 },
  { code: "CNY", label: "Юань" },
]

function formatRate(value: number, per: number) {
  const shown = value * per
  // Два знака после запятой: рубли считают до копеек, и «82,9211 ₽» читается
  // как техническая выгрузка, а не как курс. Порог по величине здесь не
  // нужен — вона и иена уже показаны за сотню и в копейки укладываются.
  return shown.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Строка курсов ЦБ над шапкой.
 *
 * Это не украшение: по этим же курсам считается цена импортного лота «под
 * ключ». Человек, который прицеливается к машине из Кореи, видит курс воны
 * сразу, а не идёт за ним на сторонний сайт.
 *
 * Приём с бесконечной прокруткой — дублирование списка и сдвиг ровно на
 * половину: в момент, когда первая копия уходит за край, вторая оказывается
 * на её месте, и шов не виден.
 */
export default function MarketTicker() {
  const { data } = useSWR<RatesResponse>("/api/exchange-rates", fetchJson, {
    // Курс ЦБ меняется раз в сутки — чаще спрашивать нечего.
    refreshInterval: 3_600_000,
    revalidateOnFocus: false,
  })

  const rates = data?.rates
  if (!rates) return null

  const items = CURRENCIES.map(({ code, label, per = 1 }) => {
    const entry = rates[code]
    if (!entry) return null
    return {
      code,
      label: per > 1 ? `${per} ${label.toLowerCase()}` : label,
      value: formatRate(entry.rateToRub, per),
    }
  }).filter(Boolean) as { code: string; label: string; value: string }[]

  if (items.length === 0) return null

  return (
    <div className="market-ticker" role="status" aria-label="Курсы Центробанка для расчёта импорта">
      <div className="market-ticker__track">
        {/* Список выводится дважды: на этом и держится бесшовная прокрутка.
            Копия скрыта от чтения с экрана, иначе диктор произнесёт курсы
            дважды подряд. */}
        {[0, 1].map((copy) => (
          <div className="market-ticker__run" key={copy} aria-hidden={copy === 1 || undefined}>
            {items.map((item) => (
              <span className="market-ticker__item" key={`${copy}-${item.code}`}>
                <span className="market-ticker__code">{item.code}</span>
                <span className="market-ticker__label">{item.label}</span>
                <span className="market-ticker__value">{item.value} ₽</span>
              </span>
            ))}
            <span className="market-ticker__item market-ticker__item--source">
              Курсы ЦБ РФ · по ним считается импорт
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
