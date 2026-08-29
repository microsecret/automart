/**
 * Источники плиток карты.
 *
 * Все источники здесь — законные: их лицензии прямо разрешают
 * использование на стороннем сайте при указании правообладателя.
 *
 * Плитки Яндекса и 2ГИС отсюда убраны сознательно, хотя они быстрее и
 * подробнее. Их адреса внутренние: в документации не описаны, лицензией
 * не разрешены, и доступ могут закрыть в любой день — карта тогда станет
 * белым пятном. Ставить сервис в зависимость от чужого недосмотра нельзя,
 * когда открытые источники дают то же самое.
 *
 * Официальные ключи Яндекса и 2ГИС существуют и покупаются: когда они
 * появятся, источник добавляется сюда одной записью.
 *
 * Модуль без импортов: список должен проверяться тестами без карты.
 */

export type TileSource = {
  id: string
  /** Как называется в переключателе. */
  label: string
  /** Шаблон адреса: {z}, {x}, {y} подставляются. */
  url: string
  maxZoom: number
  /** Указание правообладателя — требование лицензии у всех источников. */
  attribution: string
  /** Тёмная подложка: под неё подстраиваются цвета меток. */
  dark?: boolean
}

export const TILE_SOURCES: TileSource[] = [
  {
    id: "osm",
    label: "Карта",
    /* OpenStreetMap первым, хотя рисунок у него беднее CARTO.

       CARTO отдаёт плитки серверу, но браузеру с чужого домена подсовывает
       картинку «API KEY REQUIRED» — проверено на живом сайте, карта была
       заклеена этой надписью. Их бесплатный тариф требует ключа, и без
       него источник работает только в проверках curl.

       OpenStreetMap отдаёт всем и без ключа. Он и остаётся основным, пока
       не появится оплаченный ключ CARTO или официальный Яндекса. */
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  },
  {
    id: "topo",
    label: "Подробная",
    /* OpenTopoMap: та же основа, но с рельефом и более плотной подписью
       мелких улиц. Полезен в частном секторе, где заправка стоит во
       дворе. Отдаёт без ключа. */
    url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    maxZoom: 17,
    attribution: "© OpenStreetMap, © OpenTopoMap",
  },
  {
    id: "voyager",
    label: "Мягкая",
    /* CARTO Voyager — тот же OpenStreetMap, но отрисованный по-человечески:
       улицы различимы по значимости, подписи читаются на телефоне, цвета
       спокойные. Стандартная схема OSM рядом с ним выглядит чертежом.

       Подписи берутся из OpenStreetMap, то есть в России по-русски. */
    url: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    maxZoom: 20,
    attribution: "© OpenStreetMap, © CARTO",
  },
  {
    id: "dark",
    label: "Тёмная",
    /* Ночью белая карта в машине слепит. */
    url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    maxZoom: 20,
    attribution: "© OpenStreetMap, © CARTO",
    dark: true,
  },
  {
    id: "satellite",
    label: "Спутник",
    /* Снимки Esri: заправку у развязки или во дворе по схеме найти трудно,
       а на снимке видно навес и заезд. Лицензия разрешает использование
       при указании источника. */
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: "© Esri",
    dark: true,
  },
]

/** Источник по умолчанию, если в окружении ничего не задано. */
export const DEFAULT_TILE_SOURCE_ID = "osm"

export function findTileSource(id: string | null | undefined): TileSource {
  const found = TILE_SOURCES.find((source) => source.id === id)
  /* Неизвестный идентификатор — не повод показывать пустую карту:
     возвращаем первый рабочий. */
  return found ?? TILE_SOURCES.find((source) => source.id === DEFAULT_TILE_SOURCE_ID) ?? TILE_SOURCES[0]
}

/** Подставляет числа в шаблон адреса. */
export function buildTileUrl(template: string, z: number, x: number, y: number): string {
  return template
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
}
