/**
 * Источники плиток карты.
 *
 * Карта рисовалась плитками OpenStreetMap — рабочими, но выглядящими как
 * схема из двухтысячных: блёклые цвета, мелкие подписи, дороги без
 * иерархии. Рядом с картой Яндекса, которую человек видит каждый день в
 * навигаторе, это смотрится позапрошлым веком.
 *
 * Поэтому источник стал выбираемым. Значение по умолчанию задаётся
 * переменной окружения — так его можно сменить без правки кода, если
 * какой-то источник закроют или появится официальный ключ.
 *
 * Про Яндекс отдельно. Адрес core-renderer-tiles внутренний: он не
 * описан в документации, лицензия такое использование запрещает, и
 * доступ могут закрыть без предупреждения. Пока это испытание — источник
 * доступен, но выбирать его надо осознанно, а на случай отключения есть
 * запасные, которые никто не отберёт.
 *
 * Модуль без импортов: список должен проверяться тестами без карты.
 */

export type TileSource = {
  id: string
  /** Как называется в переключателе. */
  label: string
  /** Шаблон адреса: {z}, {x}, {y} подставляются. */
  url: string
  /** Второй слой поверх первого — у Яндекса подписи отдельным слоем. */
  overlayUrl?: string
  maxZoom: number
  /** Указание источника — требование лицензии у всех, кроме Яндекса. */
  attribution: string
  /** Тёмная подложка: под неё подстраиваются цвета меток. */
  dark?: boolean
  /**
   * Источник вне официальной документации.
   *
   * Такие помечаются, чтобы решение о них принималось осознанно, а не по
   * недосмотру: доступ может пропасть в любой день.
   */
  unofficial?: boolean
}

export const TILE_SOURCES: TileSource[] = [
  {
    id: "yandex",
    label: "Яндекс",
    /* Спутниковый слой у Яндекса отдельно — здесь только схема: по ней
       человек ищет заправку, а не разглядывает крыши. */
    url: "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ru_RU",
    maxZoom: 19,
    attribution: "© Яндекс",
    unofficial: true,
  },
  {
    id: "voyager",
    label: "Светлая",
    /* CARTO Voyager: тот же OpenStreetMap, но с человеческой отрисовкой —
       дороги различимы по значимости, подписи читаются на телефоне. */
    url: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: "© OpenStreetMap, © CARTO",
  },
  {
    id: "dark",
    label: "Тёмная",
    url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: "© OpenStreetMap, © CARTO",
    dark: true,
  },
  {
    id: "osm",
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  },
]

/** Источник по умолчанию, если в окружении ничего не задано. */
export const DEFAULT_TILE_SOURCE_ID = "yandex"

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
