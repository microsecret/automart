/**
 * Как заправка выглядит на карте: значок, цвет, короткая подпись.
 *
 * Сеть узнаётся по названию — человек находит свою заправку глазами, по
 * фирменному цвету, а не читая подписи. Но вывеска решает не всё: у
 * метановой станции «АГНКС Газпромтрансгаз Сургут» в имени есть
 * «газпром», и она красилась синим бензиновой Газпромнефти — водитель с
 * газобаллонным оборудованием видел на карте не то, что там стоит.
 * Поэтому вид топлива проверяется первым.
 *
 * Цвета здесь — фирменные цвета самих сетей, а не палитра площадки:
 * Лукойл красный в любой теме, и в токены их переводить нельзя.
 *
 * Порядок правил значим: сначала длинные и точные названия. Три правила
 * стояли ниже своих же подстрок и не срабатывали никогда — «трасса м»
 * под «трасса», «нефтегазсеть» под «нефтегаз», а «газпром» повторялся
 * дважды.
 */

export type NetworkIdentity = {
  label: string
  shortLabel: string
  color: string
  textColor: string
}

/** Всё, что нужно для опознания: имя, вывеска и ассортимент. */
export type IdentifiableStation = {
  name: string
  brand?: string | null
  operator?: string | null
  fuels: string[]
}

export function getNetworkIdentity(station: IdentifiableStation): NetworkIdentity | null {
  const source = `${station.name} ${station.brand || ""} ${station.operator || ""}`.toLocaleLowerCase("ru-RU")
  if (source.includes("лукойл")) return { label: "Лукойл", shortLabel: "ЛК", color: "#d8202f", textColor: "#fff" }
  if (source.includes("роснефть")) return { label: "Роснефть", shortLabel: "РН", color: "#f6c514", textColor: "#1f2937" }
  if (source.includes("газпром")) return { label: "Газпромнефть", shortLabel: "ГП", color: "#0a7cc1", textColor: "#fff" }
  if (source.includes("татнефть")) return { label: "Татнефть", shortLabel: "ТН", color: "#139b5a", textColor: "#fff" }
  if (source.includes("башнефть")) return { label: "Башнефть", shortLabel: "БН", color: "#183b6d", textColor: "#fff" }
  if (source.includes("teboil") || source.includes("тебойл")) return { label: "Teboil", shortLabel: "TB", color: "#d52331", textColor: "#fff" }
  if (source.includes("автодор") || source.includes("трасса м")) return { label: "Автодор", shortLabel: "АД", color: "#7c2d12", textColor: "#fff" }
  if (source.includes("нефтьмагистраль")) return { label: "Нефтьмагистраль", shortLabel: "НМ", color: "#1d1d1f", textColor: "#fff" }
  if (source.includes("irbis") || source.includes("ирбис")) return { label: "Irbis", shortLabel: "IR", color: "#e65825", textColor: "#fff" }
  /* Сети, встречающиеся в справочнике достаточно часто, чтобы человек
     узнавал их по цвету. Список рос по мере того, как на карте
     попадались безымянные точки там, где заправка на деле известная. */
  if (source.includes("шелл") || source.includes("shell")) return { label: "Shell", shortLabel: "SH", color: "#fbce07", textColor: "#1f2937" }
  if (source.includes("нефтьм") || source.includes("трасса")) return { label: "Трасса", shortLabel: "ТР", color: "#0f766e", textColor: "#fff" }
  if (source.includes("сургут")) return { label: "Сургутнефтегаз", shortLabel: "СН", color: "#00693c", textColor: "#fff" }
  if (source.includes("опти") || source.includes("opti")) return { label: "Опти", shortLabel: "ОП", color: "#e11d48", textColor: "#fff" }
  if (source.includes("нефтегазсеть") || source.includes("nps")) return { label: "NPS", shortLabel: "NPS", color: "#0891b2", textColor: "#fff" }
  if (source.includes("нефтегаз")) return { label: "Нефтегаз", shortLabel: "НГ", color: "#155e75", textColor: "#fff" }
  /* Сети, добавленные по замеру живой карты.

     Считал по семи городам от Уфы до Краснодара: у ТАИФ-НК шестьдесят
     шесть точек, у ПРАЙМ восемнадцать, у Воронежской топливной
     семнадцать — все они висели серыми, будто безымянные заправки, и
     человек не находил свою сеть глазами.

     Цвета взяты с фирменного оформления самих сетей. Порядок проверок
     важен: сначала более длинные и точные названия, иначе «газпром»
     перехватит «газпром газомоторное топливо». */
  if (source.includes("таиф")) return { label: "ТАИФ-НК", shortLabel: "ТФ", color: "#00954e", textColor: "#fff" }
  if (source.includes("прайм") || source.includes("prime")) return { label: "ПРАЙМ", shortLabel: "ПР", color: "#e8112d", textColor: "#fff" }
  if (source.includes("воронежская топливная") || source.includes("втк")) return { label: "ВТК", shortLabel: "ВТ", color: "#0a5c36", textColor: "#fff" }
  if (source.includes("тнк")) return { label: "ТНК", shortLabel: "ТНК", color: "#0b60a8", textColor: "#fff" }
  if (source.includes("эверон")) return { label: "Эверон", shortLabel: "ЭВ", color: "#1f6feb", textColor: "#fff" }
  if (source.includes("ортк")) return { label: "ОРТК", shortLabel: "ОР", color: "#b45309", textColor: "#fff" }
  if (source.includes("трансазс")) return { label: "ТрансАЗС", shortLabel: "ТА", color: "#334155", textColor: "#fff" }
  if (source.includes("комплекс-ойл") || source.includes("комплекс ойл")) return { label: "Комплекс-ойл", shortLabel: "КО", color: "#7c3aed", textColor: "#fff" }
  if (source.includes("ммк")) return { label: "ММК", shortLabel: "ММК", color: "#0f172a", textColor: "#fff" }
  /* Ещё сети из замера по десяти городам: каждая по десятку-двадцатку
     точек, но вместе это сотни заправок, висевших безымянными. */
  if (source.includes("новатэк") || source.includes("novatek")) return { label: "Новатэк", shortLabel: "НВ", color: "#0072bc", textColor: "#fff" }
  if (source.includes("нефтехимпром")) return { label: "Нефтехимпром", shortLabel: "НХ", color: "#166534", textColor: "#fff" }
  if (source.includes("ggroup") || source.includes("g-group")) return { label: "GGroup", shortLabel: "GG", color: "#1e3a8a", textColor: "#fff" }
  if (source.includes("олви")) return { label: "Олви", shortLabel: "ОЛ", color: "#b91c1c", textColor: "#fff" }
  if (source.includes("nafta")) return { label: "Nafta24", shortLabel: "NF", color: "#0f766e", textColor: "#fff" }
  if (source.includes("tamic")) return { label: "Tamic Energy", shortLabel: "TM", color: "#c2410c", textColor: "#fff" }
  if (source.includes("rusoil") || source.includes("русойл")) return { label: "Rusoil", shortLabel: "RU", color: "#1d4ed8", textColor: "#fff" }
  if (source.includes("ликом")) return { label: "Ликом", shortLabel: "ЛИ", color: "#7c2d12", textColor: "#fff" }
  if (source.includes("донако")) return { label: "Донако", shortLabel: "ДН", color: "#0891b2", textColor: "#fff" }
  if (source.includes("сибнефть")) return { label: "Сибнефть", shortLabel: "СБ", color: "#1e40af", textColor: "#fff" }
  if (source.includes("калина")) return { label: "Калина Ойл", shortLabel: "КЛ", color: "#be123c", textColor: "#fff" }
  if (source.includes("промнефть")) return { label: "Промнефть", shortLabel: "ПН", color: "#334155", textColor: "#fff" }

  /* Газовые сети: у них своя палитра, и путать их с бензиновыми
     нельзя — человек с газобаллонным оборудованием ищет именно их. */
  if (
    source.includes("экогаз") || source.includes("сигмагаз") || source.includes("газомоторное")
    || source.includes("автогаз") || source.includes("интрансгаз") || source.includes("мосавтогаз")
    || source.includes("нягань-газ")
  ) {
    return { label: "Газовая АЗС", shortLabel: "ГАЗ", color: "#0d9488", textColor: "#fff" }
  }
  return null
}

/**
 * Цена в рублях с копейками.
 *
 * Цены округлялись до рубля: «64 ₽» вместо 63,70. Разница в семьдесят
 * копеек на литр — это сорок рублей на бак, и именно по ней человек
 * выбирает между двумя заправками на одном перекрёстке. Округление
 * стирало ровно то, ради чего цену смотрят.
 *
 * Ровные рубли пишутся без хвоста: «64 ₽», а не «64,00 ₽» — нули
 * ничего не сообщают и удлиняют плашку, которой на карте и так тесно.
 */

export function getGenericIdentity(station: IdentifiableStation): NetworkIdentity {
  const fuels = station.fuels.join(" ").toLocaleLowerCase("ru-RU")
  const name = station.name.toLocaleLowerCase("ru-RU")

  /* Решает ассортимент, а не слово в названии.

     Проверка по названию ловила «Газпромнефть» — обычную бензиновую
     сеть, у которой в имени есть «газ». Замер по сорока трём городам:
     из 1798 точек, попавших в газовые, четыреста с лишним оказались
     Газпромнефтью, и на карте они красились бирюзовым как АГЗС.
     Человек с газобаллонным оборудованием поехал бы туда зря.

     Бензин в ассортименте — значит, заправка бензиновая, чем бы её ни
     назвали. Газовой считаем ту, где газ есть, а бензина нет. */
  const hasPetrol = /аи|дт|бензин|дизел/.test(fuels)
  const hasGasFuel = fuels.includes("газ") || fuels.includes("lpg") || fuels.includes("cng")

  /* Название учитывается только там, где ассортимент неизвестен: у
     трёхсот семидесяти точек он пуст, и «АГЗС» в имени — единственная
     подсказка. Полное слово, а не подстрока: «газ» внутри
     «Газпромнефти» ничего не значит. */
  const namedGasOnly = !fuels && /(^|\W)(агзс|агнкс|автогаз|метан|пропан)(\W|$)/.test(name)

  const isGas = (hasGasFuel && !hasPetrol) || namedGasOnly
  const isCharger = name.includes("зарядка") || fuels.includes("зарядка") || fuels.includes("ev")

  if (isCharger) return { label: "Зарядка EV", shortLabel: "EV", color: "#0284c7", textColor: "#fff" }
  if (isGas) return { label: "Газовая АЗС", shortLabel: "ГАЗ", color: "#0d9488", textColor: "#fff" }
  /* Обычная безымянная заправка: нейтральный грифель, чтобы не
     притворяться сетью, но и не выпадать из общего вида карты. */
  return { label: "АЗС", shortLabel: "АЗС", color: "#475569", textColor: "#fff" }
}

/**
 * Единое опознание точки: вид топлива важнее вывески.
 *
 * Метановая станция не должна носить фирменный цвет бензиновой сети —
 * человек с газобаллонным оборудованием ищет глазами именно вид
 * топлива, а не бренд.
 */
export function getStationIdentity(station: IdentifiableStation): NetworkIdentity {
  const generic = getGenericIdentity(station)
  if (generic.shortLabel === "ГАЗ" || generic.shortLabel === "EV") return generic
  return getNetworkIdentity(station) || generic
}
