/**
 * Сводка цен по сетям АЗС в одном городе.
 *
 * На карте человек видит цену конкретной заправки и не видит картины:
 * дорого ли вообще сегодня и у кого дешевле. Ответ на это у площадки
 * уже есть — семьдесят шесть тысяч цен по четырнадцати тысячам точек, —
 * но лежит он россыпью по карте, а не одним взглядом.
 *
 * Сводка отвечает на вопрос «куда ехать заправляться», а не «сколько
 * стоит бензин»: цены сгруппированы по сетям, потому что водитель
 * выбирает не точку, а вывеску — по карте лояльности, по привычке, по
 * тому, что она по дороге.
 *
 * Медиана, а не среднее. У Газпромнефти в Уфе среднее по трём точкам
 * давало 92 ₽ за АИ-95 при настоящей цене около 70: одна порченая
 * запись перевешивала две честные. Медиана к такому равнодушна.
 */

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { getNetworkIdentity, type NetworkIdentity } from "./fuel-station-identity.ts"

export type NetworkPriceSample = {
  name: string
  brand: string | null
  fuel: string
  priceRub: number
}

export type NetworkPriceRow = {
  /** Название сети так, как её знает водитель: «Лукойл», «Башнефть». */
  label: string
  shortLabel: string
  color: string
  textColor: string
  /** Медианная цена марки в копейках. */
  priceRub: number
  /** Сколько точек сети дали цену — мера доверия к строке. */
  stations: number
}

/*
 * Сколько точек сети нужно, чтобы её цена что-то значила.
 *
 * Замер по Уфе: у сети «ОПТИ» три точки дали медиану 116 ₽ при
 * настоящих 66 ₽ — на трёх записях одна порченая всё ещё перевешивает.
 * От пяти точек медиана держится.
 *
 * Порог отсекает и другое: случайную заправку с уникальным именем,
 * которая формально «сеть из одной точки». Такую строку человек в
 * сводке не ищет.
 */
const MIN_STATIONS_PER_NETWORK = 5

/*
 * Сводные метки в сводку не попадают.
 *
 * Безымянные заправки отсеиваются сами: опознание вывески возвращает по
 * ним пустоту. А вот «Газовая АЗС» приходит настоящей меткой — её
 * ставят полутора десяткам разных названий с «газом» внутри, от
 * «Экогаза» до «Мосавтогаза». Это не сеть, а мешок: поехать «в газовую
 * АЗС» нельзя, да и цена газа втрое ниже бензиновой — строка сломала бы
 * сортировку по дешевизне.
 */
const GENERIC_LABELS = new Set(["Газовая АЗС"])

function median(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  /* При чётном количестве берётся нижняя из двух середин, а не их
     полусумма: цена топлива — не непрерывная величина, и показывать
     несуществующие 71,255 ₽ незачем. */
  return sorted[sorted.length % 2 === 0 ? middle - 1 : middle]
}

/**
 * Считает медианную цену марки по каждой сети.
 *
 * Сеть опознаётся тем же кодом, что красит метки на карте: иначе
 * водитель увидел бы в сводке «Газпром нефть» и «Газпромнефть»
 * отдельными строками — в базе они записаны и так, и так.
 */
export function buildNetworkPrices(samples: NetworkPriceSample[]): NetworkPriceRow[] {
  const groups = new Map<string, { identity: NetworkIdentity; prices: number[] }>()

  for (const sample of samples) {
    const identity = getNetworkIdentity({
      name: sample.name,
      brand: sample.brand,
      fuels: [],
    })
    /* Вывеску опознать не удалось — в сводке такой точке не место. */
    if (!identity) continue
    if (GENERIC_LABELS.has(identity.label)) continue

    const group = groups.get(identity.label)
    if (group) group.prices.push(sample.priceRub)
    else groups.set(identity.label, { identity, prices: [sample.priceRub] })
  }

  return [...groups.values()]
    .filter((group) => group.prices.length >= MIN_STATIONS_PER_NETWORK)
    .map((group) => ({
      label: group.identity.label,
      shortLabel: group.identity.shortLabel,
      color: group.identity.color,
      textColor: group.identity.textColor,
      priceRub: median(group.prices),
      stations: group.prices.length,
    }))
    /* От дешёвой к дорогой: сводку читают ради первой строки. */
    .sort((first, second) => first.priceRub - second.priceRub)
}
