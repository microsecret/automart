"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"
import useSWR from "swr"
import { ActionIcon, Badge, Box, Button, Group, Image, Loader, Paper, Select, Stack, Text, TextInput, Tooltip, UnstyledButton } from "@mantine/core"
import { IconGasStation, IconMapPin, IconMinus, IconPlus, IconRefresh, IconSearch, IconX } from "@tabler/icons-react"
import { CITY_COORDINATES, FUEL_MAP_CITIES, findNearestCity } from "@/lib/cities"
import { fetchJson } from "@/lib/api-client"
import FuelPriceReporter, { type ConsensusPrice } from "@/components/fuel/FuelPriceReporter"
import FuelAvailabilityReporter, { type StationAvailability } from "@/components/fuel/FuelAvailabilityReporter"
import FuelSubscribeButton from "@/components/fuel/FuelSubscribeButton"
import FuelShareButton from "@/components/fuel/FuelShareButton"
import { formatAge, isFresh } from "@/lib/fuel-availability"
import { TILE_SOURCES, buildTileUrl, findTileSource } from "@/lib/map-tiles"
import { tapFeedback } from "@/lib/telegram-webapp"

type FuelStation = {
  id: string
  sourceType: "node" | "way" | "relation" | "provider"
  dataSource: "OPENSTREETMAP" | "ZAPRAVKIN" | "MERGED"
  name: string
  brand: string | null
  operator: string | null
  address: string | null
  openingHours: string | null
  fuels: string[]
  prices: Array<{ fuel: string; price: number | null; updatedAt: string | null }>
  status: "FUEL" | "NO_FUEL" | "UNKNOWN"
  statusUpdatedAt: string | null
  latitude: number
  longitude: number
}

type FuelStationsResponse = {
  city: string
  coordinates: { latitude: number; longitude: number }
  stations: FuelStation[]
  source: string
  disclaimer: string
  areaLabel?: string
  coverage: {
    dataMode: "LIVE" | "DIRECTORY"
    liveProviderConfigured: boolean
    liveStationCount: number
    directoryStationCount: number
    providerAttributionUrl: string | null
    providerState: "NOT_CONFIGURED" | "READY" | "COOLDOWN" | "BUDGET_EXHAUSTED" | "UNAVAILABLE"
    rateLimitLimit: number | null
    rateLimitRemaining: number | null
    providerRetryAt: string | null
    liveDataStale: boolean
  }
}

type FuelStationAddressResponse = {
  address: string | null
  source: "OPENSTREETMAP"
}

const TILE_SIZE = 256
const MIN_ZOOM = 9
const MAX_ZOOM = 14
const EMPTY_STATIONS: FuelStation[] = []
const EMPTY_REPORTED_PRICES: ConsensusPrice[] = []
/* Постоянная ссылка на пустой список: новый массив на каждый разбор
   заставлял бы карточку перерисовываться без причины. */
const EMPTY_AVAILABILITY: StationAvailability[] = []

type FuelPriceReportsResponse = {
  stations: Record<string, ConsensusPrice[]>
}
const FUEL_FILTERS = [
  { value: "", label: "Все типы топлива" },
  { value: "АИ‑92", label: "АИ‑92" },
  { value: "АИ‑95", label: "АИ‑95" },
  { value: "АИ‑98", label: "АИ‑98" },
  { value: "ДТ", label: "ДТ" },
  { value: "Газ", label: "Газ" },
  { value: "Зарядка EV", label: "Зарядка EV" },
]

function coordinatesToWorld(latitude: number, longitude: number, zoom: number) {
  const worldSize = TILE_SIZE * (2 ** zoom)
  const latitudeRadians = latitude * Math.PI / 180
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * worldSize,
  }
}

function worldToCoordinates(x: number, y: number, zoom: number) {
  const worldSize = TILE_SIZE * (2 ** zoom)
  const normalizedX = ((x % worldSize) + worldSize) % worldSize
  const boundedY = Math.max(0, Math.min(worldSize, y))
  const latitudeRadians = Math.PI - (2 * Math.PI * boundedY) / worldSize

  return {
    latitude: (180 / Math.PI) * Math.atan(Math.sinh(latitudeRadians)),
    longitude: (normalizedX / worldSize) * 360 - 180,
  }
}

type MapMarker = {
  left: number
  top: number
  stations: FuelStation[]
}

type StationDataQuality = "live" | "fuel" | "network" | "basic"

type NetworkIdentity = {
  label: string
  shortLabel: string
  color: string
  textColor: string
}

function getStationNetwork(station: FuelStation) {
  return station.brand || station.operator || null
}

function getStationNetworkKey(station: FuelStation) {
  return getNetworkIdentity(station)?.label || getStationNetwork(station) || null
}

function getNetworkIdentity(station: FuelStation): NetworkIdentity | null {
  const source = `${station.name} ${station.brand || ""} ${station.operator || ""}`.toLocaleLowerCase("ru-RU")
  if (source.includes("лукойл")) return { label: "Лукойл", shortLabel: "ЛК", color: "#d8202f", textColor: "#fff" }
  if (source.includes("роснефть")) return { label: "Роснефть", shortLabel: "РН", color: "#f6c514", textColor: "#1f2937" }
  if (source.includes("газпром")) return { label: "Газпромнефть", shortLabel: "ГП", color: "#0a7cc1", textColor: "#fff" }
  if (source.includes("татнефть")) return { label: "Татнефть", shortLabel: "ТН", color: "#139b5a", textColor: "#fff" }
  if (source.includes("башнефть")) return { label: "Башнефть", shortLabel: "БН", color: "#183b6d", textColor: "#fff" }
  if (source.includes("teboil") || source.includes("тебойл")) return { label: "Teboil", shortLabel: "TB", color: "#d52331", textColor: "#fff" }
  if (source.includes("нефтьмагистраль")) return { label: "Нефтьмагистраль", shortLabel: "НМ", color: "#1d1d1f", textColor: "#fff" }
  if (source.includes("irbis") || source.includes("ирбис")) return { label: "Irbis", shortLabel: "IR", color: "#e65825", textColor: "#fff" }
  /* Сети, встречающиеся в справочнике достаточно часто, чтобы человек
     узнавал их по цвету. Список рос по мере того, как на карте
     попадались безымянные точки там, где заправка на деле известная. */
  if (source.includes("шелл") || source.includes("shell")) return { label: "Shell", shortLabel: "SH", color: "#fbce07", textColor: "#1f2937" }
  if (source.includes("нефтьм") || source.includes("трасса")) return { label: "Трасса", shortLabel: "ТР", color: "#0f766e", textColor: "#fff" }
  if (source.includes("сургут")) return { label: "Сургутнефтегаз", shortLabel: "СН", color: "#00693c", textColor: "#fff" }
  if (source.includes("газпром") || source.includes("gazprom")) return { label: "Газпромнефть", shortLabel: "ГП", color: "#0a7cc1", textColor: "#fff" }
  if (source.includes("опти") || source.includes("opti")) return { label: "Опти", shortLabel: "ОП", color: "#e11d48", textColor: "#fff" }
  if (source.includes("нефтегаз")) return { label: "Нефтегаз", shortLabel: "НГ", color: "#155e75", textColor: "#fff" }
  if (source.includes("автодор") || source.includes("трасса м")) return { label: "Автодор", shortLabel: "АД", color: "#7c2d12", textColor: "#fff" }
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
function formatKopecks(kopecks: number) {
  const roubles = kopecks / 100
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: Number.isInteger(roubles) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(roubles)
}

function getDistanceInKilometers(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const latitudeFrom = radians(from.latitude)
  const latitudeTo = radians(to.latitude)
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeFrom) * Math.cos(latitudeTo) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function getStationDataQuality(station: FuelStation): StationDataQuality {
  if (station.status !== "UNKNOWN" || station.prices.length) return "live"
  if (station.fuels.length) return "fuel"
  if (getStationNetwork(station)) return "network"
  return "basic"
}

function getStationDataSummary(station: FuelStation) {
  if (station.status === "FUEL") return "Поставщик подтверждает наличие топлива"
  if (station.status === "NO_FUEL") return "Поставщик сообщает: топлива сейчас нет"
  if (station.prices.length) return "Цены опубликованы подключённым поставщиком"
  if (station.fuels.length) return "В OSM опубликованы типы топлива"
  if (getStationNetwork(station)) return "В OSM указана сеть АЗС"
  return "Точка АЗС без подробных тегов"
}


function FuelStationMap({ city, coordinates, stations, selectedStation, selectedStationAddress, onSelect, onViewportChange, availabilityByStation, pricesByStation, selectedStationPrices, selectedStationAvailability, onPricesReported, onAvailabilityReported }: {
  city: string
  coordinates: { latitude: number; longitude: number }
  stations: FuelStation[]
  selectedStation: FuelStation | null
  selectedStationAddress: string | null
  /* null закрывает карточку: крестик снимает выбор, а не выбирает
     что-то ещё. */
  onSelect: (station: FuelStation | null) => void
  onViewportChange: (coordinates: { latitude: number; longitude: number }) => void
  /* Отметки и цены выбранной точки: карточка живёт на карте, и форма
     отметки теперь тоже здесь — значит, ей нужны эти данные. */
  selectedStationPrices: ConsensusPrice[]
  selectedStationAvailability: StationAvailability[]
  onPricesReported: (stationId: string, prices: ConsensusPrice[]) => void
  onAvailabilityReported: (stationId: string, rows: StationAvailability[]) => void
  /* Отметки водителей по видимым точкам: по ним метка красится и
     подписывается. Без них карта показывает только то, что знает
     OpenStreetMap, — то есть ассортимент вообще, а не наличие сейчас. */
  availabilityByStation: Record<string, StationAvailability[]>
  /* Цены от водителей: на плашке видно, почём топливо, — иначе за ценой
     надо открывать карточку каждой заправки по очереди. */
  pricesByStation: Record<string, ConsensusPrice[]>
}) {
  const [zoom, setZoom] = useState(11)
  /* Выбранный источник плиток живёт в браузере: человек выбрал тёмную
     карту один раз, и она остаётся тёмной при следующем заходе. Хранить
     это на сервере незачем — выбор личный и ничего не стоит потерять. */
  const [tileSourceId, setTileSourceId] = useState(() => {
    if (typeof window === "undefined") return TILE_SOURCES[0].id
    try {
      return window.localStorage.getItem("lewheel:map-tiles") || TILE_SOURCES[0].id
    } catch {
      /* Приватное окно или запрет на хранилище — не повод падать. */
      return TILE_SOURCES[0].id
    }
  })
  const tileSource = findTileSource(tileSourceId)
  const [viewportCenter, setViewportCenter] = useState(coordinates)
  /* Заказанный кадр перерисовки: держим ссылку, чтобы отменить его при
     следующем движении и не копить очередь устаревших положений. */
  const pendingFrame = useRef<number | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [clusterHint, setClusterHint] = useState<string | null>(null)
  const mapInteractionRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ pointerId: number; clientX: number; clientY: number; center: { latitude: number; longitude: number } } | null>(null)
  const viewportCenterRef = useRef(viewportCenter)
  const mapViewport = viewportSize.width > 0 && viewportSize.height > 0 ? viewportSize : { width: 768, height: 460 }
  const center = useMemo(() => coordinatesToWorld(viewportCenter.latitude, viewportCenter.longitude, zoom), [viewportCenter.latitude, viewportCenter.longitude, zoom])
  const tileCount = 2 ** zoom
  const mapOrigin = useMemo(() => ({
    x: center.x - mapViewport.width / 2,
    y: center.y - mapViewport.height / 2,
  }), [center.x, center.y, mapViewport.height, mapViewport.width])
  const updateZoom = (nextZoom: number) => setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom)))

  /* Карта возвращается к обзорному масштабу только при смене места, а
     не на любое обновление координат.

     Раньше эффект слушал сами координаты. Человек приближал карту,
     сдвиг подгружал новый участок, сервер отвечал уточнённым центром —
     и масштаб откатывался к одиннадцатому. Со стороны это выглядело
     так, будто нажатие на заправку отменяет приближение: приблизил,
     ткнул, тебя выбросило назад.

     Теперь сброс привязан к названию места. Сменил город или нашёл
     посёлок — карта показывает его целиком; двигаешь и приближаешь
     внутри — масштаб твой. */
  const areaKey = city
  useEffect(() => {
    const nextCenter = { latitude: coordinates.latitude, longitude: coordinates.longitude }
    setViewportCenter(nextCenter)
    viewportCenterRef.current = nextCenter
    setZoom(11)
    /* Координаты намеренно не в зависимостях: они меняются при каждой
       подгрузке участка, а сброс нужен только на смене места. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaKey])

  const selectedLatitude = selectedStation?.latitude
  const selectedLongitude = selectedStation?.longitude
  useEffect(() => {
    if (selectedLatitude == null || selectedLongitude == null) return

    const nextCenter = { latitude: selectedLatitude, longitude: selectedLongitude }
    setViewportCenter(nextCenter)
    viewportCenterRef.current = nextCenter
    setZoom((current) => Math.max(current, 13))
  }, [selectedLatitude, selectedLongitude])

  // React может зарегистрировать wheel-подписку на корне документа, а браузер
  // в таком режиме вправе проигнорировать preventDefault. Для карты нужен
  // гарантированно активный обработчик: колесо над полотном меняет масштаб,
  // а не прокручивает страницу.
  useEffect(() => {
    const mapNode = mapInteractionRef.current
    if (!mapNode) return

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault()
      setZoom((currentZoom) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + (event.deltaY < 0 ? 1 : -1))))
    }

    mapNode.addEventListener("wheel", handleNativeWheel, { passive: false })
    return () => mapNode.removeEventListener("wheel", handleNativeWheel)
  }, [])

  useEffect(() => {
    const mapNode = mapInteractionRef.current
    if (!mapNode) return

    const syncViewportSize = () => {
      const bounds = mapNode.getBoundingClientRect()
      setViewportSize({ width: Math.max(1, Math.round(bounds.width)), height: Math.max(1, Math.round(bounds.height)) })
    }

    syncViewportSize()
    if (typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(syncViewportSize)
    observer.observe(mapNode)
    return () => observer.disconnect()
  }, [])

  const tiles = useMemo(() => {
    const startX = Math.floor(mapOrigin.x / TILE_SIZE) - 1
    const endX = Math.ceil((mapOrigin.x + mapViewport.width) / TILE_SIZE) + 1
    const startY = Math.max(0, Math.floor(mapOrigin.y / TILE_SIZE) - 1)
    const endY = Math.min(tileCount - 1, Math.ceil((mapOrigin.y + mapViewport.height) / TILE_SIZE) + 1)
    const visibleTiles: Array<{ key: string; x: number; y: number; left: number; top: number }> = []

    for (let sourceY = startY; sourceY <= endY; sourceY += 1) {
      for (let sourceX = startX; sourceX <= endX; sourceX += 1) {
        const x = ((sourceX % tileCount) + tileCount) % tileCount
        visibleTiles.push({
          key: `${zoom}-${sourceX}-${sourceY}`,
          x,
          y: sourceY,
          left: sourceX * TILE_SIZE - mapOrigin.x,
          top: sourceY * TILE_SIZE - mapOrigin.y,
        })
      }
    }

    return visibleTiles
  }, [mapOrigin.x, mapOrigin.y, mapViewport.height, mapViewport.width, tileCount, zoom])

  const visibleStations = useMemo(() => stations.flatMap((station) => {
    const point = coordinatesToWorld(station.latitude, station.longitude, zoom)
    const worldSize = TILE_SIZE * (2 ** zoom)
    let deltaX = point.x - center.x
    if (deltaX > worldSize / 2) deltaX -= worldSize
    if (deltaX < -worldSize / 2) deltaX += worldSize
    const left = deltaX + mapViewport.width / 2
    const top = point.y - center.y + mapViewport.height / 2
    return left > -48 && left < mapViewport.width + 48 && top > -48 && top < mapViewport.height + 48 ? [{ station, left, top }] : []
  }), [center.x, center.y, mapViewport.height, mapViewport.width, stations, zoom])

  const markers = useMemo<MapMarker[]>(() => {
    /* Группировка держится до четырнадцатого масштаба, а не до
       двенадцатого.

       Раньше на двенадцатом все точки распадались по отдельности: в
       городе их больше тысячи, и экран превращался в кашу из
       перекрывающихся меток. Попасть пальцем в нужную было нельзя.

       На четырнадцатом видно квартал — там точки уже не налезают друг
       на друга, и распад оправдан. */
    if (zoom > 13) return visibleStations.map(({ station, left, top }) => ({ left, top, stations: [station] }))

    const clusters = new Map<string, MapMarker>()
    visibleStations.forEach(({ station, left, top }) => {
      /* Ячейка группировки — 72 пикселя вместо 56.

         Метка занимает 44 пикселя (палец), и при ячейке в 56 соседние
         группы стояли впритык. Семьдесят два дают промежуток, в котором
         глаз различает их как отдельные. */
      const key = `${Math.round(left / 72)}:${Math.round(top / 72)}`
      const existing = clusters.get(key)
      if (existing) {
        const count = existing.stations.length
        existing.left = (existing.left * count + left) / (count + 1)
        existing.top = (existing.top * count + top) / (count + 1)
        existing.stations.push(station)
      } else {
        clusters.set(key, { left, top, stations: [station] })
      }
    })

    return Array.from(clusters.values())
  }, [visibleStations, zoom])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    dragState.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, center: viewportCenter }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(false)
  }

  /* Незаконченный кадр после снятия компонента обновил бы состояние
     несуществующего узла — React на это ругается в консоль. */
  useEffect(() => () => {
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current)
  }, [])

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.clientX
    const deltaY = event.clientY - drag.clientY
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) setIsDragging(true)

    const start = coordinatesToWorld(drag.center.latitude, drag.center.longitude, zoom)
    const worldSize = TILE_SIZE * (2 ** zoom)
    const nextX = ((start.x - deltaX) % worldSize + worldSize) % worldSize
    const edgePadding = TILE_SIZE / 2
    const nextY = Math.max(edgePadding, Math.min(worldSize - edgePadding, start.y - deltaY))
    const nextCenter = worldToCoordinates(nextX, nextY, zoom)
    viewportCenterRef.current = nextCenter

    /* Состояние обновляется раз на кадр, а не на каждое движение пальца.
       Событий pointermove браузер шлёт до сотни в секунду, и на каждом
       перерисовывалось всё дерево: плитки, метки, подписи. Карта дёргалась
       именно поэтому — работы было втрое больше, чем кадров.

       Кадр отменяется при следующем движении: рисуем последнее положение,
       а не очередь устаревших. */
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current)
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null
      setViewportCenter(viewportCenterRef.current)
    })
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragState.current = null
    onViewportChange(viewportCenterRef.current)
    window.setTimeout(() => setIsDragging(false), 0)
  }

  const moveCenterBy = (deltaX: number, deltaY: number) => {
    const start = coordinatesToWorld(viewportCenter.latitude, viewportCenter.longitude, zoom)
    const worldSize = TILE_SIZE * (2 ** zoom)
    const nextX = ((start.x + deltaX) % worldSize + worldSize) % worldSize
    const edgePadding = TILE_SIZE / 2
    const nextY = Math.max(edgePadding, Math.min(worldSize - edgePadding, start.y + deltaY))
    const nextCenter = worldToCoordinates(nextX, nextY, zoom)
    viewportCenterRef.current = nextCenter
    setViewportCenter(nextCenter)
    onViewportChange(nextCenter)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = TILE_SIZE * 0.26
    const directions: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault()
      updateZoom(zoom + 1)
      return
    }

    if (event.key === "-") {
      event.preventDefault()
      updateZoom(zoom - 1)
      return
    }

    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    moveCenterBy(direction.x, direction.y)
  }

  const handleMarkerClick = (marker: MapMarker) => {
    if (marker.stations.length === 1) {
      setClusterHint(null)
      onSelect(marker.stations[0])
      return
    }

    const average = marker.stations.reduce((result, station) => ({ latitude: result.latitude + station.latitude, longitude: result.longitude + station.longitude }), { latitude: 0, longitude: 0 })
    setViewportCenter({ latitude: average.latitude / marker.stations.length, longitude: average.longitude / marker.stations.length })
    updateZoom(zoom + 2)
    setClusterHint(`Здесь ${marker.stations.length} АЗС. Карта приближена — выберите конкретную точку, чтобы увидеть топливо, цены и адрес.`)
  }

  return (
    <Paper id="fuel-station-map" className="fuel-map-canvas" radius="md" withBorder>
      <Box ref={mapInteractionRef} className={`fuel-map-canvas__tiles${isDragging ? " is-dragging" : ""}`} aria-label={`Интерактивная карта точек АЗС: ${city}. Стрелки перемещают карту, плюс и минус меняют масштаб.`} role="region" tabIndex={0} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onKeyDown={handleKeyDown}>
        <Box className="fuel-map-canvas__tile-layer" aria-hidden="true">
        {tiles.map((tile) => (
          <Image key={tile.key} src={buildTileUrl(tileSource.url, zoom, tile.x, tile.y)} style={{ transform: `translate3d(${tile.left}px, ${tile.top}px, 0)` }} alt="" aria-hidden="true" />
        ))}
        </Box>
        {markers.map((marker, index) => {
          const isCluster = marker.stations.length > 1
          const firstStation = marker.stations[0]
          const dataQuality = getStationDataQuality(firstStation)
          const networkIdentity = getNetworkIdentity(firstStation)
          const isSelected = marker.stations.some((station) => selectedStation?.id === station.id && selectedStation.sourceType === station.sourceType)
          /* Отметки водителей по этой точке: они и есть ответ на вопрос
             «есть ли топливо сейчас», тогда как теги OpenStreetMap
             говорят лишь про ассортимент вообще. */
          /* Состояние кластера: сколько заправок внутри с топливом.

             Кружок показывал только число — «5 АЗС», и человек не знал,
             стоит ли туда приближаться. Теперь кольцо красится по доле:
             зелёное — почти везде есть, красное — почти нигде. Решение
             принимается на дальнем масштабе, без приближения. */
          const clusterState = isCluster
            ? (() => {
                let withFuel = 0
                let known = 0
                for (const station of marker.stations) {
                  const rows = (availabilityByStation[station.id] || [])
                    .filter((row) => row.updatedAt && isFresh(new Date(row.updatedAt)))
                  if (rows.length === 0) continue
                  known += 1
                  if (rows.some((row) => row.state === "YES")) withFuel += 1
                }
                if (known === 0) return "unknown"
                const share = withFuel / known
                return share >= 0.6 ? "yes" : share > 0 ? "some" : "no"
              })()
            : null

          const reported = isCluster ? [] : (availabilityByStation[firstStation.id] || [])
          const fresh = reported.filter((row) => row.updatedAt && isFresh(new Date(row.updatedAt)))
          const anyYes = fresh.some((row) => row.state === "YES")
          const anyNo = fresh.some((row) => row.state === "NO")
          /* Цены водителей по этой точке: на плашке они стоят рядом с
             маркой, и за ценой не надо открывать карточку. */
          const prices = isCluster ? [] : (pricesByStation[firstStation.id] || [])
          const priceByFuel = new Map(prices.map((row) => [row.fuel, row.priceKopecks]))

          /* Плашка вместо кружка — при близком масштабе.

             Кружок отвечает только на вопрос «здесь заправка»: чтобы
             узнать сеть, наличие и цену, надо нажать и прочитать
             карточку. На плашке это видно сразу, и человек за рулём
             выбирает заправку глазами, а не перебором.

             Далеко плашки не показываются: на весь город их сотни, они
             перекрывают друг друга, и карта перестаёт читаться. Там
             остаётся кружок — он мелкий и не мешает. */
          /* Плашка с двенадцатого масштаба, а не с четырнадцатого.

             Карта открывается на одиннадцатом, точки перестают
             группироваться сразу после него — и на двенадцатом-
             тринадцатом человек видел голые кружки без названия сети.
             Ровно то состояние, в котором карту открывают чаще всего.

             Ниже двенадцатого плашки не нужны: там точки ещё собраны в
             кластеры, а поверх них плашка не поместится. */
          const showPlate = !isCluster && zoom >= 12

          const label = isCluster ? `${marker.stations.length} АЗС — приблизить карту` : `Показать ${firstStation.name}: ${getStationDataSummary(firstStation)}`

          if (showPlate) {
            /* Марки: сначала отмеченные водителями, потом те, что знает
               OpenStreetMap. Отметка свежее и вернее тега, но когда её
               нет, тег лучше пустоты. */
            const plateFuels = fresh.length
              ? fresh.slice(0, 4).map((row) => ({
                  key: row.fuel,
                  label: row.label,
                  state: row.state === "YES" ? "yes" : "no",
                  price: priceByFuel.get(row.fuel) ?? null,
                }))
              : firstStation.fuels.slice(0, 3).map((fuel) => ({
                  key: fuel,
                  label: fuel,
                  state: "unknown" as const,
                  price: null,
                }))

            return (
              <Box
                key={firstStation.id}
                className="fuel-map-pin"
                data-plate="true"
                style={{ transform: `translate3d(calc(${marker.left}px - 50%), calc(${marker.top}px - 100%), 0)` }}
              >
                <UnstyledButton
                  className="fuel-map-plate"
                  data-selected={isSelected || undefined}
                  data-reported={fresh.length ? (anyYes ? "yes" : anyNo ? "no" : undefined) : undefined}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => handleMarkerClick(marker)}
                  aria-label={label}
                >
                  {/* Знак сети слева: фирменный цвет и две буквы.

                      Цветной полоски было мало — человек видел, что
                      заправка «красная», но не понимал, Лукойл это или
                      Опти. Настоящие логотипы ставить нельзя: это чужие
                      товарные знаки, и на карте они означали бы
                      согласованное присутствие сети, которого нет.

                      Буквы решают то же: «ЛК» на красном человек читает
                      как Лукойл с одного взгляда, а спутать с чужим
                      знаком это невозможно. */}
                  {networkIdentity ? (
                    <span
                      className="fuel-map-plate__logo"
                      style={{ background: networkIdentity.color, color: networkIdentity.textColor }}
                      aria-hidden="true"
                    >
                      {networkIdentity.shortLabel}
                    </span>
                  ) : (
                    /* Сеть не распознана: серый знак заправки вместо
                       букв — иначе плашка выглядит сломанной. */
                    <span className="fuel-map-plate__logo" data-unknown="true" aria-hidden="true">
                      <IconGasStation size={11} />
                    </span>
                  )}
                  <span className="fuel-map-plate__body">
                    <span className="fuel-map-plate__title">
                      {networkIdentity?.label || firstStation.name}
                    </span>
                    {plateFuels.length > 0 && (
                      <span className="fuel-map-plate__fuels">
                        {plateFuels.map((item) => (
                          <span key={item.key} className="fuel-map-plate__fuel" data-state={item.state}>
                            {item.label}
                            {item.price !== null && (
                              <b className="fuel-map-plate__price">{formatKopecks(item.price)}</b>
                            )}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </UnstyledButton>
                {/* Хвостик книзу: он и указывает на саму точку — без него
                    плашка висит в воздухе рядом с заправкой. */}
                <span className="fuel-map-plate__tail" aria-hidden="true" />
              </Box>
            )
          }

          return (
            <Box key={isCluster ? `cluster-${index}` : firstStation.id} className="fuel-map-pin" style={{ transform: `translate3d(calc(${marker.left}px - 50%), calc(${marker.top}px - 15px), 0)` }}>
              <UnstyledButton className="fuel-map-marker" data-cluster={isCluster || undefined} data-cluster-state={clusterState || undefined} data-quality={isCluster ? "cluster" : dataQuality} data-reported={!isCluster && fresh.length ? (anyYes ? "yes" : anyNo ? "no" : undefined) : undefined} data-selected={isSelected || undefined} style={{
                /* Цвет сети — только там, где про наличие ничего не
                   известно.

                   Раньше он стоял всегда, а наличие показывалось тонким
                   кольцом вокруг. На карте с домами и дорогами кольцо в
                   три пикселя теряется, и человек, ищущий бензин, видел
                   мешанину фирменных цветов вместо ответа.

                   Теперь наличие красит кружок целиком: зелёный есть,
                   красный нет. Сеть при этом никуда не делась — её
                   буквы стоят внутри кружка, а на плашке рядом
                   фирменный знак с названием. */
                ...(networkIdentity && !isCluster && fresh.length === 0
                  ? { backgroundColor: networkIdentity.color, color: networkIdentity.textColor }
                  : {}),
              }} onPointerDown={(event) => event.stopPropagation()} onClick={() => handleMarkerClick(marker)} aria-label={label} title={isCluster ? `${marker.stations.length} АЗС` : `${firstStation.name} · ${getStationDataSummary(firstStation)}`}>{isCluster ? marker.stations.length : networkIdentity ? <span className="fuel-map-marker__network">{networkIdentity.shortLabel}</span> : <IconGasStation size={15} />}</UnstyledButton>
            </Box>
          )
        })}
      </Box>
      {/* Переключатель вида карты.

          Схема OpenStreetMap выглядит как чертёж из двухтысячных рядом с
          картой, которую человек видит каждый день в навигаторе. Выбор
          запоминается в браузере: сменил один раз — осталось навсегда. */}
      <Group className="fuel-map-canvas__tiles-switch" gap={3}>
        {TILE_SOURCES.map((source) => (
          <UnstyledButton
            key={source.id}
            onClick={() => {
              setTileSourceId(source.id)
              try {
                window.localStorage.setItem("lewheel:map-tiles", source.id)
              } catch {
                /* Приватное окно: выбор просто не запомнится. */
              }
            }}
            data-active={source.id === tileSourceId || undefined}
            className="fuel-map-tile-option"
            aria-label={`Вид карты: ${source.label}`}
            aria-pressed={source.id === tileSourceId}
          >
            {source.label}
          </UnstyledButton>
        ))}
      </Group>

      <Group className="fuel-map-canvas__controls" gap={4}>
        <Tooltip label="Уменьшить масштаб"><ActionIcon variant="white" color="dark" size="sm" radius="md" onClick={() => updateZoom(zoom - 1)} aria-label="Уменьшить масштаб карты"><IconMinus size={15} /></ActionIcon></Tooltip>
        <Tooltip label="Увеличить масштаб"><ActionIcon variant="white" color="dark" size="sm" radius="md" onClick={() => updateZoom(zoom + 1)} aria-label="Увеличить масштаб карты"><IconPlus size={15} /></ActionIcon></Tooltip>
      </Group>
      <Box className="fuel-map-canvas__caption"><IconMapPin size={14} /><Text size="xs">{visibleStations.length} точек · {tileSource.attribution}</Text></Box>
      {/* Обозначения переписаны под отметки водителей: раньше они объясняли
     качество данных OpenStreetMap — «есть live-данные», «сеть указана», —
     а человек смотрит на карту с вопросом «где есть бензин», и цвет
     метки теперь отвечает именно на него. */}
      <Box className="fuel-map-canvas__legend" aria-label="Обозначения точек на карте"><Text component="span" data-reported="yes">Топливо есть</Text><Text component="span" data-reported="no">Топлива нет</Text><Text component="span" data-quality="fuel">Не отмечали</Text></Box>
      {clusterHint && <Paper className="fuel-map-cluster-hint" radius="md" p="xs" withBorder aria-live="polite"><Text size="xs" fw={600}>{clusterHint}</Text><Button size="compact-xs" variant="subtle" color="indigo" onClick={() => setClusterHint(null)}>Понятно</Button></Paper>}
      {selectedStation && (() => {
        /* Карточка точки — единственное место, где человек читает про
           заправку и отмечает наличие.

           Список рядом с картой убран: он отвечал на тот же вопрос
           хуже, потому что строка «Роснефть, 1,1 км» не показывает, по
           пути это или в обратную сторону. Всё, что было в списке,
           переехало сюда — к метке, на которую человек нажал.

           Кнопок навигаторов здесь нет. Они уводили человека из
           сервиса ровно в тот момент, когда от него нужна отметка, а
           маршрут до заправки, которую он видит на карте, он строит
           сам и в своём навигаторе. */
        const rows = availabilityByStation[selectedStation.id] || []
        const fresh = rows.filter((row) => row.updatedAt && isFresh(new Date(row.updatedAt)))
        const prices = pricesByStation[selectedStation.id] || []
        const priceByFuel = new Map(prices.map((row) => [row.fuel, row.priceKopecks]))
        const newest = fresh.reduce<string | null>(
          (latest, row) => (!latest || (row.updatedAt && row.updatedAt > latest) ? row.updatedAt : latest),
          null,
        )
        const weakest = fresh.find((row) => row.confidenceLabel !== "высокая")
        const identity = getNetworkIdentity(selectedStation)
        const distanceKm = getDistanceInKilometers(coordinates, selectedStation)

        /* Марки, которые есть по свежим отметкам: ради них заправкой и
           делятся. */
        const availableFuels = fresh.filter((row) => row.state === "YES").map((row) => row.label)

        return (
          <Paper className="fuel-map-selected" radius="md" withBorder aria-live="polite">
            <Box className="fuel-map-selected__head">
              {identity && (
                <span
                  className="fuel-map-selected__logo"
                  style={{ background: identity.color, color: identity.textColor }}
                  aria-hidden="true"
                >
                  {identity.shortLabel}
                </span>
              )}
              <Box style={{ minWidth: 0, flex: 1 }}>
                <Text size="sm" fw={800} lineClamp={1}>{selectedStation.name}</Text>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {selectedStation.address || selectedStationAddress || "Уточняем адрес…"}
                  {/* Расстояние от центра карты: человек смотрит на
                      участок, который сам выбрал, и «1,2 км» отвечает на
                      вопрос «далеко ли отсюда» без открытия маршрута. */}
                  {distanceKm > 0.05
                    ? ` · ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} м` : `${distanceKm.toFixed(1).replace(".", ",")} км`}`
                    : ""}
                </Text>
              </Box>
              {/* Закрыть карточку: без крестика она снимается только
                  повторным нажатием на ту же метку, а её к этому
                  моменту закрывает сама карточка. */}
              <ActionIcon
                variant="subtle"
                color="gray"
                radius="xl"
                onClick={() => onSelect(null)}
                aria-label="Закрыть карточку заправки"
                className="fuel-map-selected__close"
              >
                <IconX size={16} />
              </ActionIcon>
            </Box>

            <Box className="fuel-map-selected__body">
              {/* Что есть сейчас — с ценой рядом с маркой. */}
              {fresh.length > 0 ? (
                <Group gap={4} wrap="wrap">
                  {fresh.slice(0, 6).map((row) => {
                    const kopecks = priceByFuel.get(row.fuel)
                    return (
                      <Badge
                        key={row.fuel}
                        size="lg"
                        radius="sm"
                        variant="light"
                        color={row.state === "YES" ? "teal" : "red"}
                        styles={row.state === "NO" ? { label: { textDecoration: "line-through" } } : undefined}
                      >
                        {row.label}
                        {row.state === "YES" && kopecks ? ` · ${formatKopecks(kopecks)} ₽` : ""}
                      </Badge>
                    )
                  })}
                </Group>
              ) : (
                /* Отметок нет — так и говорим. Молчание человек читает как
                   «топлива нет», и это неправда. */
                <Text size="xs" c="dimmed">Здесь ещё не отмечали наличие</Text>
              )}

              {/* Возраст и уверенность — по ним человек решает, верить ли. */}
              {newest && (
                <Text size="xs" c={weakest ? "orange.7" : "dimmed"}>
                  Обновлено {formatAge(new Date(newest))}
                  {weakest ? ` · уверенность ${weakest.confidencePercent}%` : ""}
                </Text>
              )}

              {/* Отметка наличия прямо в карточке.

                  Раньше форма жила в списке сбоку: человек нажимал метку
                  на карте, потом искал ту же заправку в списке справа и
                  только там мог отметить. Два поиска одного и того же
                  ради одного действия — до него не доходили. */}
              <FuelAvailabilityReporter
                stationId={selectedStation.id}
                stationName={selectedStation.name}
                city={city}
                latitude={selectedStation.latitude}
                longitude={selectedStation.longitude}
                availability={selectedStationAvailability}
                onReported={(next) => onAvailabilityReported(selectedStation.id, next)}
              />

              <Group gap={6} grow>
                <FuelSubscribeButton
                  stationId={selectedStation.id}
                  stationName={selectedStation.name}
                  city={city}
                />
                {/* Поделиться: выбор сетей виден сразу.

                    Прежняя кнопка на настольном браузере молча
                    копировала ссылку — нажал, ничего не произошло, и
                    было непонятно, сработало ли. */}
                <FuelShareButton
                  stationName={selectedStation.name}
                  address={selectedStation.address || selectedStationAddress}
                  latitude={selectedStation.latitude}
                  longitude={selectedStation.longitude}
                  availableFuels={availableFuels}
                />
              </Group>

              <FuelPriceReporter
                stationId={selectedStation.id}
                latitude={selectedStation.latitude}
                longitude={selectedStation.longitude}
                prices={selectedStationPrices}
                onReported={(next) => onPricesReported(selectedStation.id, next)}
              />
            </Box>
          </Paper>
        )
      })()}
    </Paper>
  )
}

/** Где хранится выбранный город: тот же ключ читается при следующем заходе. */
const CITY_STORAGE_KEY = "lewheel:fuel-city"

export default function FuelMapPage() {
  /* Город берётся из прошлого выбора, а не начинается с Москвы.

     Человек из Уфы открывал карту, видел Москву и менял город руками —
     каждый раз, после каждого захода. Выбор личный и ничего не стоит
     потерять, поэтому хранится в браузере, а не на сервере.

     Ниже, если выбора ещё не было, город определяется по координатам:
     сперва из Telegram, затем из браузера. */
  const [city, setCity] = useState(() => {
    if (typeof window === "undefined") return "Москва"
    try {
      const saved = window.localStorage.getItem(CITY_STORAGE_KEY)
      return saved && CITY_COORDINATES[saved] ? saved : "Москва"
    } catch {
      /* Приватное окно или запрет на хранилище — не повод падать. */
      return "Москва"
    }
  })
  /* Определение по местоположению делается один раз за сеанс: человек
     мог сознательно уехать смотреть другой город, и второе срабатывание
     вернуло бы его обратно. */
  const hasLocatedRef = useRef(false)
  const [placeQuery, setPlaceQuery] = useState("")
  const [place, setPlace] = useState<string | null>(null)
  const [fuelFilter, setFuelFilter] = useState("")
  const [networkFilter, setNetworkFilter] = useState("")
  const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null)
  const [viewportCoordinates, setViewportCoordinates] = useState(CITY_COORDINATES[city])
  const [requestedCoordinates, setRequestedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [liveRefreshTimestamp, setLiveRefreshTimestamp] = useState<number | null>(null)
  const cityCoordinates = CITY_COORDINATES[city] || CITY_COORDINATES["Москва"]
  const fuelStationsUrl = useMemo(() => {
    const params = new URLSearchParams({ city })
    if (place) params.set("place", place)
    if (requestedCoordinates) {
      params.set("latitude", requestedCoordinates.latitude.toFixed(5))
      params.set("longitude", requestedCoordinates.longitude.toFixed(5))
    }
    if (liveRefreshTimestamp && Date.now() - liveRefreshTimestamp < 12_000) params.set("refresh", String(liveRefreshTimestamp))
    return `/api/fuel-stations?${params.toString()}`
  }, [city, place, requestedCoordinates, liveRefreshTimestamp])
  const { data, error, isLoading, isValidating, mutate } = useSWR<FuelStationsResponse>(fuelStationsUrl, fetchJson, { revalidateOnFocus: false })
  const coordinates = data?.coordinates || requestedCoordinates || cityCoordinates
  const areaLabel = data?.areaLabel || place || city

  /* Точки подгружаются сами, когда карту сдвинули.

     Раньше нужно было нажать «Загрузить участок»: человек двигал карту к
     своему посёлку, видел пустоту и решал, что заправок там нет. В
     Чекмагуше их шесть, включая три Башнефти, — API их отдаёт, но карта
     не спрашивала.

     Ждём полторы секунды после остановки: без паузы запрос улетал бы на
     каждое движение пальца, а OpenStreetMap за такое ограничивает
     доступ. Полторы секунды — время, за которое человек успевает
     остановиться и посмотреть на карту.

     Порог в километр, а не 350 метров: мелкие сдвиги в пределах города
     ничего не меняют, точки уже загружены с запасом. */
  useEffect(() => {
    const km = getDistanceInKilometers(coordinates, viewportCoordinates)
    if (km <= 1) return

    const timer = window.setTimeout(() => {
      setRequestedCoordinates(viewportCoordinates)
    }, 1500)

    return () => window.clearTimeout(timer)
  }, [coordinates, viewportCoordinates])
  const allStations = data?.stations ?? EMPTY_STATIONS
  const centerLatitude = coordinates.latitude
  const centerLongitude = coordinates.longitude
  const networkFilters = useMemo(() => {
    const networks = allStations
      .map(getStationNetworkKey)
      .filter((value): value is string => Boolean(value))

    return [
      { value: "", label: "Все сети" },
      ...Array.from(new Set(networks))
        .sort((first, second) => first.localeCompare(second, "ru-RU"))
        .map((value) => ({ value, label: value })),
    ]
  }, [allStations])
  const filteredStations = useMemo(() => {
    const matchingStations = allStations.filter((station) => (
      (!fuelFilter || station.fuels.includes(fuelFilter))
      && (!networkFilter || getStationNetworkKey(station) === networkFilter)
    ))

    // В списке первыми показываем ближайшие АЗС — именно так пользователь
    // выбирает точку для поездки, а не только по алфавиту сети.
    return [...matchingStations].sort((first, second) => (
      getDistanceInKilometers({ latitude: centerLatitude, longitude: centerLongitude }, first)
      - getDistanceInKilometers({ latitude: centerLatitude, longitude: centerLongitude }, second)
    ))
  }, [allStations, centerLatitude, centerLongitude, fuelFilter, networkFilter])
  const selectedAddress = selectedStation?.address
  const selectedAddressLatitude = selectedStation?.latitude
  const selectedAddressLongitude = selectedStation?.longitude
  const selectedStationAddressUrl = useMemo(() => {
    if (selectedAddress || selectedAddressLatitude == null || selectedAddressLongitude == null) return null
    const params = new URLSearchParams({ detail: "address", latitude: selectedAddressLatitude.toFixed(6), longitude: selectedAddressLongitude.toFixed(6) })
    return `/api/fuel-stations?${params.toString()}`
  }, [selectedAddress, selectedAddressLatitude, selectedAddressLongitude])
  const { data: selectedStationAddressData } = useSWR<FuelStationAddressResponse>(selectedStationAddressUrl, fetchJson, { revalidateOnFocus: false })
  const selectedStationAddress = selectedStation?.address || selectedStationAddressData?.address || null

  // Цены водителей приходят отдельным запросом: справочник точек кэшируется
  // надолго, а отметка должна становиться видимой сразу после сохранения.
  const selectedStationId = selectedStation?.id || null
  const reportedPricesUrl = selectedStationId ? `/api/fuel-prices?stations=${encodeURIComponent(selectedStationId)}` : null
  const { data: reportedPricesData, mutate: mutateReportedPrices } = useSWR<FuelPriceReportsResponse>(reportedPricesUrl, fetchJson, { revalidateOnFocus: false })
  const selectedStationPrices = (selectedStationId && reportedPricesData?.stations?.[selectedStationId]) || EMPTY_REPORTED_PRICES
  const handlePricesReported = (stationId: string, prices: ConsensusPrice[]) => {
    mutateReportedPrices((current) => ({ stations: { ...(current?.stations || {}), [stationId]: prices } }), { revalidate: false })
  }

  /* Наличие приходит своим запросом: оно меняется за минуты, тогда как
     справочник точек кэшируется надолго, а цены — часами. */
  const availabilityUrl = selectedStationId ? `/api/fuel-availability?stations=${encodeURIComponent(selectedStationId)}` : null
  const { data: availabilityData, mutate: mutateAvailability } = useSWR<{ stations?: Record<string, StationAvailability[]> }>(
    availabilityUrl,
    fetchJson,
    /* Обновление при возврате на вкладку здесь уместно, в отличие от цен:
       человек мог отойти к колонке и вернуться — за это время наличие
       успевает измениться. */
    { revalidateOnFocus: true },
  )
  const selectedStationAvailability = (selectedStationId && availabilityData?.stations?.[selectedStationId]) || EMPTY_AVAILABILITY

  /* Отметки по всем видимым точкам разом — для списка «куда ехать».
     Запрашивать их по одной значило бы триста запросов на открытие карты;
     маршрут принимает список и отвечает одним ответом.

     Ограничение в сорок точек: список показывает восемь ближайших, и
     тянуть отметки по всему городу ради них незачем. */
  /* Отметки и цены запрашиваются по точкам, ближайшим к центру карты, а
     не по первым сорока из списка.

     Список отсортирован по расстоянию от центра города, а человек может
     смотреть на окраину — там отметки не запрашивались вовсе, и плашки
     оставались без цены и наличия. Точек на карте больше тысячи, все
     сразу спрашивать нельзя: адрес запроса не поместится.

     Сто ближайших к тому месту, куда человек смотрит, покрывают экран с
     запасом на любом масштабе. */
  const nearbyStationIds = useMemo(() => {
    const center = viewportCoordinates
    return [...filteredStations]
      .map((station) => ({ station, km: getDistanceInKilometers(center, station) }))
      .sort((left, right) => left.km - right.km)
      .slice(0, 100)
      .map((row) => row.station.id)
      .join(",")
  }, [filteredStations, viewportCoordinates])
  /* Цены по всем видимым точкам — для плашек на карте. Тем же одним
     запросом, что и отметки: по одной на точку вышло бы триста запросов
     на открытие карты. */
  const { data: nearbyPricesData, mutate: mutateNearbyPrices } = useSWR<FuelPriceReportsResponse>(
    nearbyStationIds ? `/api/fuel-prices?stations=${encodeURIComponent(nearbyStationIds)}` : null,
    fetchJson,
    { revalidateOnFocus: false },
  )

  const { data: nearbyAvailabilityData } = useSWR<{ stations?: Record<string, StationAvailability[]> }>(
    nearbyStationIds ? `/api/fuel-availability?stations=${encodeURIComponent(nearbyStationIds)}` : null,
    fetchJson,
    { revalidateOnFocus: false },
  )
  const handleAvailabilityReported = (stationId: string, rows: StationAvailability[]) => {
    mutateAvailability((current) => ({ stations: { ...(current?.stations || {}), [stationId]: rows } }), { revalidate: false })

    /* Цена уходит вместе с отметкой наличия, но живёт в своём запросе:
       без этого человек ставил цену, а в списке оставалось «цен пока
       никто не отмечал» — он решал, что не сохранилось, и ставил снова. */
    void mutateReportedPrices()
    void mutateNearbyPrices()
  }

  useEffect(() => {
    setSelectedStation(null)
    setRequestedCoordinates(null)
    setViewportCoordinates(cityCoordinates)
  }, [city, cityCoordinates])

  /* Смена фильтра снимает выбор: выбранная заправка могла не пройти
     новый фильтр, и карточка висела бы над картой, где её метки уже
     нет. */
  useEffect(() => {
    setSelectedStation(null)
  }, [fuelFilter, networkFilter])

  // A refresh can replace an OSM/provider record with a newer snapshot. Keep
  // the opened card aligned with that snapshot instead of showing stale fuel
  // tags, prices or an address from the previous response.
  useEffect(() => {
    if (!selectedStation) return

    const refreshedStation = allStations.find((station) => (
      station.id === selectedStation.id && station.sourceType === selectedStation.sourceType
    ))

    if (!refreshedStation) {
      setSelectedStation(null)
      return
    }

    if (refreshedStation !== selectedStation) setSelectedStation(refreshedStation)
  }, [allStations, selectedStation])

  const handlePlaceSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPlace = placeQuery.trim().replace(/\s+/g, " ")
    if (nextPlace.length < 2) return
    setRequestedCoordinates(null)
    setSelectedStation(null)
    if (nextPlace === place) void mutate()
    else setPlace(nextPlace)
  }

  /* Выбранный город запоминается: следующий заход открывается на нём. */
  useEffect(() => {
    try {
      window.localStorage.setItem(CITY_STORAGE_KEY, city)
    } catch {
      /* Хранилище закрыто настройками — выбор просто не запомнится. */
    }
  }, [city])

  /* Город по местоположению — при первом заходе, пока человек ничего не
     выбирал сам.

     Источник — обычная браузерная геолокация: внутри мини-приложения
     Telegram она тоже работает, потому что там открыт тот же движок
     браузера. Отдельный Location API Telegram не используется — он
     требует свежей версии клиента, а выигрыша не даёт.

     Отказ ничего не ломает: остаётся Москва, а город меняется списком,
     как и раньше. Спрашивать разрешение повторно после отказа нельзя —
     это выглядит как навязчивость и всё равно не работает. */
  useEffect(() => {
    if (hasLocatedRef.current) return
    /* Человек уже выбирал город раньше — его выбор важнее координат. */
    try {
      if (window.localStorage.getItem(CITY_STORAGE_KEY)) {
        hasLocatedRef.current = true
        return
      }
    } catch {
      /* Хранилище недоступно: определяем по координатам. */
    }

    hasLocatedRef.current = true

    const applyPoint = (latitude: number, longitude: number) => {
      const nearest = findNearestCity({ latitude, longitude })
      /* Дальше двухсот километров ближайший город уже не описывает
         место: человек в тайге получил бы город, до которого полдня
         езды. Тогда честнее оставить выбор за ним. */
      if (!nearest.name || nearest.km > 200) return
      setCity(nearest.name)
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => applyPoint(position.coords.latitude, position.coords.longitude),
      () => {
        /* Отказ или сбой: остаётся город по умолчанию. */
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 10 * 60 * 1000 },
    )
  }, [])

  const handleRefresh = () => setLiveRefreshTimestamp(Date.now())


  return (
    <Box className="service-page service-page--fuel-map">
      {/* Карта занимает экран целиком.

          Раньше рядом стоял список заправок в две колонки из пяти. Он
          отвечал на тот же вопрос, что и карта, — «где заправка», — но
          хуже: без расположения на местности строчка «Роснефть, 1,1 км»
          не говорит, по пути это или в обратную сторону.

          Всё, что было в списке, ушло в карточку точки: она открывается
          нажатием на метку и показывает наличие, цены и действия там же,
          где человек смотрит. Экран остался один, и он весь карта. */}
      <Box className="fuel-map-shell">
        <FuelStationMap
          city={areaLabel}
          coordinates={coordinates}
          stations={filteredStations}
          selectedStation={selectedStation}
          selectedStationAddress={selectedStationAddress}
          onSelect={setSelectedStation}
          onViewportChange={setViewportCoordinates}
          availabilityByStation={nearbyAvailabilityData?.stations || {}}
          pricesByStation={nearbyPricesData?.stations || {}}
          selectedStationPrices={selectedStationPrices}
          selectedStationAvailability={selectedStationAvailability}
          onPricesReported={handlePricesReported}
          onAvailabilityReported={handleAvailabilityReported}
        />

        {/* Панель управления поверх карты, а не над ней.

            Отдельной строкой она отнимала у карты полосу высотой с
            собственный рост. Поверх — не отнимает ничего: карта под ней
            продолжается, а сама панель занимает верхний край, куда
            всё равно не смотрят. */}
        <Box className="fuel-map-topbar">
          <Box component="form" onSubmit={handlePlaceSearch} className="fuel-map-topbar__search">
            <TextInput
              aria-label="Введите населённый пункт или трассу"
              placeholder="Город, посёлок или участок трассы"
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.currentTarget.value)}
              size="sm"
              radius="xl"
              leftSection={<IconSearch size={15} />}
              rightSection={
                /* Сброс поиска, когда он задан: без него человек,
                   нашедший участок трассы, не может вернуться к городу —
                   выбор в списке ниже перекрыт поиском. */
                place ? (
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => { setPlace(null); setPlaceQuery("") }}
                    aria-label="Сбросить поиск места"
                  >
                    <IconX size={14} />
                  </ActionIcon>
                ) : null
              }
            />
          </Box>

          {/* Топливо — лентой кнопок, а не выпадающим списком.

              Список стоил трёх действий ради выбора между вариантами,
              которые помещаются в строку. Здесь нужная марка нажимается
              сразу, а лента прокручивается вбок: частые 92, 95 и ДТ
              остаются на виду, редкие уезжают за край. */}
          <Box className="fuel-map-fuel-chips" role="group" aria-label="Тип топлива">
            {FUEL_FILTERS.map((option) => (
              <UnstyledButton
                key={option.value || "all"}
                className="fuel-map-fuel-chip"
                data-active={fuelFilter === option.value || undefined}
                onClick={() => { tapFeedback("light"); setFuelFilter(option.value) }}
                aria-pressed={fuelFilter === option.value}
              >
                {option.value ? option.label.replace("АИ‑", "") : "Все"}
              </UnstyledButton>
            ))}
          </Box>

          <Select
            aria-label="Выберите город"
            data={FUEL_MAP_CITIES.map((value) => ({ value, label: value }))}
            value={place ? null : city}
            onChange={(value) => { if (value) { setPlace(null); setPlaceQuery(""); setCity(value) } }}
            searchable
            size="sm"
            radius="xl"
            className="fuel-map-topbar__city"
            placeholder="Город"
          />

          <Select
            aria-label="Выберите сеть АЗС"
            data={networkFilters}
            value={networkFilter}
            /* Пустая строка, а не «all»: фильтр сравнивает значение с
               ключом сети, и слово «all» не совпадало ни с одной —
               сброс на «Все сети» очищал список вместо того, чтобы
               показать всё. */
            onChange={(value) => setNetworkFilter(value || "")}
            size="sm"
            radius="xl"
            className="fuel-map-topbar__network"
          />

          <Tooltip label="Обновить данные">
            <ActionIcon
              variant="default"
              size="lg"
              radius="xl"
              onClick={handleRefresh}
              loading={isLoading || isValidating}
              aria-label="Обновить данные о заправках"
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Box>

        {/* Состояние загрузки поверх карты.

            Первое открытие города занимает несколько секунд: точки
            приходят из OpenStreetMap. Всё это время человек видел пустую
            карту и не понимал, работает ли сервис. */}
        {isLoading && (
          <Paper className="fuel-map-toast" radius="xl" p="xs" withBorder>
            <Group gap={8} wrap="nowrap">
              <Loader size="xs" />
              <Text size="xs" fw={600}>Ищем заправки{areaLabel ? ` — ${areaLabel}` : ""}</Text>
            </Group>
          </Paper>
        )}

        {!isLoading && !error && filteredStations.length === 0 && (
          <Paper className="fuel-map-toast" radius="xl" p="xs" withBorder>
            <Text size="xs" fw={600}>Точки не найдены. Смените топливо, сеть или город.</Text>
          </Paper>
        )}

        {data?.coverage.liveDataStale && (
          <Paper className="fuel-map-toast" radius="xl" p="xs" withBorder>
            <Text size="xs" c="orange.7" fw={600}>Поставщик недоступен — показываем сохранённую выборку.</Text>
          </Paper>
        )}

        {error && (
          <Paper className="fuel-map-toast" radius="xl" p="sm" withBorder>
            <Stack gap={6}>
              <Text size="xs" fw={700}>Не удалось получить точки АЗС</Text>
              <Button size="compact-sm" variant="light" onClick={() => mutate()}>Повторить</Button>
            </Stack>
          </Paper>
        )}
      </Box>
    </Box>
  )
}
