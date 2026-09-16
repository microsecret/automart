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

/*
 * Во сколько раз цена сети может превышать медиану города.
 *
 * См. разбор у места применения: значение стоит в разрыве между
 * рыночными ценами и вымыслом источников.
 */
const MAX_CITY_MEDIAN_RATIO = 1.15

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

  /* Цена города — мера, с которой сверяются сети.
     Считается по всем пробам сразу, до группировки: одна порченая сеть
     не сдвинет медиану полутора тысяч цен. */
  const cityMedian = samples.length ? median(samples.map((sample) => sample.priceRub)) : 0

  return [...groups.values()]
    .filter((group) => group.prices.length >= MIN_STATIONS_PER_NETWORK)
    .filter((group) => {
      /* Системный сдвиг источника: цена сети не лезет ни в какие ворота
         рядом с соседями по городу.

         Поштучные правила его не видят — внутри записи всё согласовано.
         У «Нефтьмагистрали» в Москве на восьмидесяти восьми точках
         стоит 93 ₽ за АИ-92 и 104 ₽ за АИ-95: девяносто второй дешевле
         девяносто пятого, коридор пройден, а цена всё равно вымысел при
         московской медиане 71,94 ₽. Порча пришла из обоих источников
         разом, то есть это их общая беда, а не опечатка.

         Порог взят из самих данных, а не назначен на глаз. Замер по
         Москве, Казани и Екатеринбургу: настоящие сети кучкуются в
         диапазоне от 0,90 до 1,09 медианы города — они торгуют по
         рынку, иначе к ним не поедут. Дальше идёт разрыв, и всё, что
         лежит за ним, оказалось вымыслом: Эверон 1,22, Irbis 1,20,
         GGroup 1,34, Нефтьмагистраль 1,40.

         1,15 стоит в этом разрыве: с запасом над честным хвостом и
         ниже начала вымысла. */
      if (!cityMedian) return true
      return median(group.prices) <= cityMedian * MAX_CITY_MEDIAN_RATIO
    })
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
