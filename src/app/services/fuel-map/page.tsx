"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"
import useSWR from "swr"
import { ActionIcon, Anchor, Badge, Box, Button, Center, Group, Loader, Paper, Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Tooltip } from "@mantine/core"
import { IconExternalLink, IconGasStation, IconMapPin, IconMinus, IconPlus, IconRefresh, IconRoute, IconSearch } from "@tabler/icons-react"
import { CITY_COORDINATES, FUEL_MAP_CITIES } from "@/lib/cities"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

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
  }
}

const TILE_SIZE = 256
const MAP_WORLD_SPAN = TILE_SIZE * 3
const MIN_ZOOM = 9
const MAX_ZOOM = 14
const STATION_LIST_PAGE_SIZE = 24
const EMPTY_STATIONS: FuelStation[] = []
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
  return null
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

function formatDistance(distance: number) {
  return distance < 1 ? `${Math.max(50, Math.round(distance * 1000 / 50) * 50)} м` : `${distance.toFixed(distance < 10 ? 1 : 0).replace(".", ",")} км`
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

function getStationStatus(station: FuelStation) {
  if (station.status === "FUEL") return { label: "Есть топливо", color: "teal" }
  if (station.status === "NO_FUEL") return { label: "Нет топлива", color: "red" }
  return { label: "Нет live-данных", color: "gray" }
}

function formatStationTimestamp(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)
}

function formatFuelPrice(price: number | null) {
  return price === null ? null : new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(price)
}

function FuelStationMap({ city, coordinates, stations, selectedStation, onSelect, onViewportChange }: {
  city: string
  coordinates: { latitude: number; longitude: number }
  stations: FuelStation[]
  selectedStation: FuelStation | null
  onSelect: (station: FuelStation) => void
  onViewportChange: (coordinates: { latitude: number; longitude: number }) => void
}) {
  const [zoom, setZoom] = useState(11)
  const [viewportCenter, setViewportCenter] = useState(coordinates)
  const [isDragging, setIsDragging] = useState(false)
  const mapInteractionRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ pointerId: number; clientX: number; clientY: number; center: { latitude: number; longitude: number }; width: number; height: number } | null>(null)
  const viewportCenterRef = useRef(viewportCenter)
  const center = useMemo(() => coordinatesToWorld(viewportCenter.latitude, viewportCenter.longitude, zoom), [viewportCenter.latitude, viewportCenter.longitude, zoom])
  const centerTileX = Math.floor(center.x / TILE_SIZE)
  const centerTileY = Math.floor(center.y / TILE_SIZE)
  const tileCount = 2 ** zoom
  const tileOffsetX = -(((center.x / TILE_SIZE) - centerTileX) - 0.5) * (100 / 3)
  const tileOffsetY = -(((center.y / TILE_SIZE) - centerTileY) - 0.5) * (100 / 3)
  const updateZoom = (nextZoom: number) => setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom)))

  useEffect(() => {
    setViewportCenter(coordinates)
    viewportCenterRef.current = coordinates
    setZoom(11)
  }, [coordinates.latitude, coordinates.longitude])

  useEffect(() => {
    if (!selectedStation) return

    const nextCenter = { latitude: selectedStation.latitude, longitude: selectedStation.longitude }
    setViewportCenter(nextCenter)
    viewportCenterRef.current = nextCenter
    setZoom((current) => Math.max(current, 13))
  }, [selectedStation?.id, selectedStation?.sourceType])

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

  const visibleStations = useMemo(() => stations.flatMap((station) => {
    const point = coordinatesToWorld(station.latitude, station.longitude, zoom)
    const worldSize = TILE_SIZE * (2 ** zoom)
    let deltaX = point.x - center.x
    if (deltaX > worldSize / 2) deltaX -= worldSize
    if (deltaX < -worldSize / 2) deltaX += worldSize
    const left = ((deltaX + MAP_WORLD_SPAN / 2) / MAP_WORLD_SPAN) * 100
    const top = ((point.y - center.y + MAP_WORLD_SPAN / 2) / MAP_WORLD_SPAN) * 100
    return left > -4 && left < 104 && top > -4 && top < 104 ? [{ station, left, top }] : []
  }), [center.x, center.y, stations, zoom])

  const markers = useMemo<MapMarker[]>(() => {
    if (zoom > 11) return visibleStations.map(({ station, left, top }) => ({ left, top, stations: [station] }))

    const clusters = new Map<string, MapMarker>()
    visibleStations.forEach(({ station, left, top }) => {
      const key = `${Math.round(left / 5)}:${Math.round(top / 5)}`
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
    const bounds = event.currentTarget.getBoundingClientRect()
    dragState.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, center: viewportCenter, width: bounds.width, height: bounds.height }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(false)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.clientX
    const deltaY = event.clientY - drag.clientY
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) setIsDragging(true)

    const start = coordinatesToWorld(drag.center.latitude, drag.center.longitude, zoom)
    const worldSize = TILE_SIZE * (2 ** zoom)
    const nextX = ((start.x - (deltaX / drag.width) * MAP_WORLD_SPAN) % worldSize + worldSize) % worldSize
    const edgePadding = TILE_SIZE / 2
    const nextY = Math.max(edgePadding, Math.min(worldSize - edgePadding, start.y - (deltaY / drag.height) * MAP_WORLD_SPAN))
    const nextCenter = worldToCoordinates(nextX, nextY, zoom)
    viewportCenterRef.current = nextCenter
    setViewportCenter(nextCenter)
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
      onSelect(marker.stations[0])
      return
    }

    const average = marker.stations.reduce((result, station) => ({ latitude: result.latitude + station.latitude, longitude: result.longitude + station.longitude }), { latitude: 0, longitude: 0 })
    setViewportCenter({ latitude: average.latitude / marker.stations.length, longitude: average.longitude / marker.stations.length })
    updateZoom(zoom + 2)
  }

  return (
    <Paper id="fuel-station-map" className="fuel-map-canvas" radius="lg" withBorder>
      <Box ref={mapInteractionRef} className={`fuel-map-canvas__tiles${isDragging ? " is-dragging" : ""}`} aria-label={`Интерактивная карта точек АЗС: ${city}. Стрелки перемещают карту, плюс и минус меняют масштаб.`} role="region" tabIndex={0} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onKeyDown={handleKeyDown}>
        <Box className="fuel-map-canvas__tile-layer" style={{ transform: `translate(${tileOffsetX}%, ${tileOffsetY}%)` }} aria-hidden="true">
        {[-1, 0, 1, 2].flatMap((row) => [-1, 0, 1, 2].map((column) => {
          const x = (centerTileX + column + tileCount) % tileCount
          const y = Math.max(0, Math.min(tileCount - 1, centerTileY + row))
          return <img key={`${zoom}-${x}-${y}`} src={`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`} alt="" aria-hidden="true" />
        }))}
        </Box>
        {markers.map((marker, index) => {
          const isCluster = marker.stations.length > 1
          const firstStation = marker.stations[0]
          const dataQuality = getStationDataQuality(firstStation)
          const networkIdentity = getNetworkIdentity(firstStation)
          const isSelected = marker.stations.some((station) => selectedStation?.id === station.id && selectedStation.sourceType === station.sourceType)
          const label = isCluster ? `${marker.stations.length} АЗС — приблизить карту` : `Показать ${firstStation.name}: ${getStationDataSummary(firstStation)}`
          return <button key={isCluster ? `cluster-${index}` : firstStation.id} type="button" className="fuel-map-marker" data-cluster={isCluster || undefined} data-quality={isCluster ? "cluster" : dataQuality} data-selected={isSelected || undefined} style={{ left: `${marker.left}%`, top: `${marker.top}%`, ...(networkIdentity && !isCluster ? { backgroundColor: networkIdentity.color, color: networkIdentity.textColor } : {}) }} onPointerDown={(event) => event.stopPropagation()} onClick={() => handleMarkerClick(marker)} aria-label={label} title={isCluster ? `${marker.stations.length} АЗС` : `${firstStation.name} · ${getStationDataSummary(firstStation)}`}>{isCluster ? marker.stations.length : networkIdentity ? <span className="fuel-map-marker__network">{networkIdentity.shortLabel}</span> : <IconGasStation size={15} />}</button>
        })}
      </Box>
      <Group className="fuel-map-canvas__controls" gap={4}>
        <Tooltip label="Уменьшить масштаб"><ActionIcon variant="white" color="dark" size="sm" radius="md" onClick={() => updateZoom(zoom - 1)} aria-label="Уменьшить масштаб карты"><IconMinus size={15} /></ActionIcon></Tooltip>
        <Tooltip label="Увеличить масштаб"><ActionIcon variant="white" color="dark" size="sm" radius="md" onClick={() => updateZoom(zoom + 1)} aria-label="Увеличить масштаб карты"><IconPlus size={15} /></ActionIcon></Tooltip>
      </Group>
      <Box className="fuel-map-canvas__caption"><IconMapPin size={14} /><Text size="xs">{visibleStations.length} точек · тяните карту, масштабируйте колесом</Text></Box>
      <Box className="fuel-map-canvas__legend" aria-label="Обозначения точек на карте"><Text component="span" data-quality="live">Есть live-данные</Text><Text component="span" data-quality="fuel">Топливо отмечено</Text><Text component="span" data-quality="network">Сеть указана</Text><Text component="span" data-quality="basic">Без тегов</Text></Box>
      {selectedStation && <Paper className="fuel-map-selected" radius="md" p="xs" withBorder aria-live="polite"><Group justify="space-between" gap="xs" wrap="nowrap"><Text size="xs" fw={750} lineClamp={1}>{selectedStation.name}</Text><Badge size="xs" color={getStationStatus(selectedStation).color} variant="light">{getStationStatus(selectedStation).label}</Badge></Group><Text size="10px" c="dimmed" lineClamp={1}>{selectedStation.address || getStationNetwork(selectedStation) || "Адрес не указан"}</Text><Group gap={4} mt={4} wrap="wrap">{selectedStation.prices.length ? selectedStation.prices.slice(0, 3).map((price) => <Badge key={price.fuel} size="xs" color="teal" variant="light">{price.fuel}{formatFuelPrice(price.price) ? ` · ${formatFuelPrice(price.price)} ₽` : ""}</Badge>) : selectedStation.fuels.length ? selectedStation.fuels.slice(0, 4).map((fuel) => <Badge key={fuel} size="xs" color="teal" variant="light">{fuel}</Badge>) : <Badge size="xs" color="gray" variant="light">Ассортимент не указан</Badge>}</Group><Text size="10px" c="indigo.7" mt={3} lineClamp={1}>{formatStationTimestamp(selectedStation.statusUpdatedAt) ? `Обновлено: ${formatStationTimestamp(selectedStation.statusUpdatedAt)}` : selectedStation.fuels.length ? "Топливо отмечено в OpenStreetMap" : getStationDataSummary(selectedStation)}</Text></Paper>}
    </Paper>
  )
}

function FuelStationCard({ station, referenceCoordinates, isSelected, onShowOnMap }: {
  station: FuelStation
  referenceCoordinates: { latitude: number; longitude: number }
  isSelected: boolean
  onShowOnMap: (station: FuelStation) => void
}) {
  const dataQuality = getStationDataQuality(station)
  const network = getStationNetwork(station)
  const networkIdentity = getNetworkIdentity(station)
  const networkLabel =
    network && network.toLocaleLowerCase("ru-RU") !== station.name.toLocaleLowerCase("ru-RU") ? network : null
  const stationStatus = getStationStatus(station)
  const iconColor = dataQuality === "live" ? stationStatus.color : dataQuality === "fuel" ? "teal" : dataQuality === "network" ? "orange" : "gray"
  const statusUpdated = formatStationTimestamp(station.statusUpdatedAt)
  const distance = formatDistance(getDistanceInKilometers(referenceCoordinates, station))

  return (
    <Paper className="fuel-station-card" data-selected={isSelected || undefined} radius="md" p="sm" withBorder>
      <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant={networkIdentity ? "filled" : "light"} color={iconColor} radius="md" style={networkIdentity ? { backgroundColor: networkIdentity.color, color: networkIdentity.textColor } : undefined}>{networkIdentity ? networkIdentity.shortLabel : <IconGasStation size={17} />}</ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Text fw={750} size="sm" lineClamp={1}>{station.name}</Text>
            <Text size="xs" c="dimmed" lineClamp={1}>{station.address || network || "Адрес не указан"}</Text>
          </Box>
        </Group>
        {station.sourceType !== "provider" && <Anchor href={`https://www.openstreetmap.org/${station.sourceType}/${station.id.replace(/^osm-[^-]+-/, "")}`} target="_blank" rel="noreferrer" aria-label={`Открыть ${station.name} в OpenStreetMap`}><IconExternalLink size={16} /></Anchor>}
      </Group>
      <Group mt={8} gap={5} wrap="wrap">
        {networkLabel && <Badge size="xs" variant={networkIdentity ? "filled" : "outline"} color="orange" style={networkIdentity ? { backgroundColor: networkIdentity.color, color: networkIdentity.textColor } : undefined}>{networkLabel}</Badge>}
        <Badge size="xs" variant="light" color={stationStatus.color}>{stationStatus.label}</Badge>
        <Badge size="xs" variant="outline" color="gray">{distance} от центра</Badge>
        {station.prices.length
          ? station.prices.map((price) => <Badge key={`${price.fuel}-${price.price}`} size="xs" variant="light" color="teal">{price.fuel}{formatFuelPrice(price.price) ? ` · ${formatFuelPrice(price.price)} ₽` : ""}</Badge>)
          : station.fuels.length
            ? station.fuels.map((fuel) => <Badge key={fuel} size="xs" variant="light" color="teal">{fuel}</Badge>)
            : <Badge size="xs" variant="outline" color="gray">Ассортимент не указан</Badge>}
        {station.openingHours && <Badge size="xs" variant="outline" color="gray">{station.openingHours}</Badge>}
      </Group>
      <Text size="10px" c="dimmed" mt={7}>{statusUpdated ? `Данные обновлены: ${statusUpdated}` : getStationDataSummary(station)}</Text>
      <Group mt={8} gap={4}>
        <Button variant="subtle" color="indigo" size="compact-xs" onClick={() => onShowOnMap(station)} leftSection={<IconMapPin size={13} />}>На карте</Button>
        <Button component="a" href={`https://www.openstreetmap.org/directions?from=&to=${station.latitude}%2C${station.longitude}`} target="_blank" rel="noreferrer" variant="subtle" color="indigo" size="compact-xs" leftSection={<IconRoute size={13} />}>Маршрут</Button>
      </Group>
    </Paper>
  )
}

export default function FuelMapPage() {
  const [city, setCity] = useState("Москва")
  const [placeQuery, setPlaceQuery] = useState("")
  const [place, setPlace] = useState<string | null>(null)
  const [fuelFilter, setFuelFilter] = useState("")
  const [networkFilter, setNetworkFilter] = useState("")
  const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null)
  const [viewportCoordinates, setViewportCoordinates] = useState(CITY_COORDINATES[city])
  const [requestedCoordinates, setRequestedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [visibleStationCount, setVisibleStationCount] = useState(STATION_LIST_PAGE_SIZE)
  const cityCoordinates = CITY_COORDINATES[city] || CITY_COORDINATES["Москва"]
  const fuelStationsUrl = useMemo(() => {
    const params = new URLSearchParams({ city })
    if (place) params.set("place", place)
    if (requestedCoordinates) {
      params.set("latitude", requestedCoordinates.latitude.toFixed(5))
      params.set("longitude", requestedCoordinates.longitude.toFixed(5))
    }
    return `/api/fuel-stations?${params.toString()}`
  }, [city, place, requestedCoordinates])
  const { data, error, isLoading, isValidating, mutate } = useSWR<FuelStationsResponse>(fuelStationsUrl, fetchJson, { revalidateOnFocus: false })
  const coordinates = data?.coordinates || requestedCoordinates || cityCoordinates
  const areaLabel = data?.areaLabel || place || city
  const isViewingMapArea = Boolean(requestedCoordinates)
  const allStations = data?.stations ?? EMPTY_STATIONS
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
      getDistanceInKilometers(coordinates, first) - getDistanceInKilometers(coordinates, second)
    ))
  }, [allStations, coordinates.latitude, coordinates.longitude, fuelFilter, networkFilter])
  const displayedStations = filteredStations.slice(0, visibleStationCount)
  const hasMoreStations = displayedStations.length < filteredStations.length
  const selectedStationKey = selectedStation ? `${selectedStation.sourceType}-${selectedStation.id}` : null
  const selectedStationInResults = selectedStation && filteredStations.some((station) => `${station.sourceType}-${station.id}` === selectedStationKey)
    ? selectedStation
    : null
  const listedStations = selectedStationKey
    ? displayedStations.filter((station) => `${station.sourceType}-${station.id}` !== selectedStationKey)
    : displayedStations

  useEffect(() => {
    setSelectedStation(null)
    setRequestedCoordinates(null)
    setViewportCoordinates(cityCoordinates)
    setVisibleStationCount(STATION_LIST_PAGE_SIZE)
  }, [city, cityCoordinates])

  useEffect(() => {
    setVisibleStationCount(STATION_LIST_PAGE_SIZE)
  }, [fuelStationsUrl])

  useEffect(() => {
    setSelectedStation(null)
    setVisibleStationCount(STATION_LIST_PAGE_SIZE)
  }, [fuelFilter, networkFilter])

  useEffect(() => {
    if (!selectedStation) return

    const selectedIndex = allStations.findIndex((station) => station.id === selectedStation.id && station.sourceType === selectedStation.sourceType)
    if (selectedIndex >= visibleStationCount) {
      setVisibleStationCount((current) => Math.max(current, Math.ceil((selectedIndex + 1) / STATION_LIST_PAGE_SIZE) * STATION_LIST_PAGE_SIZE))
    }
  }, [allStations, selectedStation, visibleStationCount])

  const showStationOnMap = (station: FuelStation) => {
    setSelectedStation(station)
    document.getElementById("fuel-station-map")?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const handleCityChange = (value: string | null) => {
    setCity(value || "Москва")
    setPlace(null)
    setPlaceQuery("")
  }

  const handlePlaceSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPlace = placeQuery.trim().replace(/\s+/g, " ")
    if (nextPlace.length < 2) return
    setRequestedCoordinates(null)
    setSelectedStation(null)
    if (nextPlace === place) void mutate()
    else setPlace(nextPlace)
  }

  return (
    <Box className="service-page service-page--fuel-map" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Paper className="fuel-map-hero" radius="xl" p={{ base: "lg", md: "xl" }}>
          <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
            <Stack gap="sm" maw={680}>
              <Group gap="sm"><ThemeIcon size={44} radius="lg" variant="white" color="indigo"><IconGasStation size={23} /></ThemeIcon><Badge variant="white" color="dark" radius="xl">СЕРВИС ДЛЯ ПОЕЗДКИ</Badge></Group>
              <Box><Text component="h1" fz={{ base: 28, md: 38 }} fw={850} lh={1.08} c="white" ff="var(--font-display),sans-serif">Карта АЗС России</Text><Text c="rgba(255,255,255,0.8)" mt={8} maw={620}>Выберите город, посмотрите открытые точки заправок и сразу постройте маршрут в привычном картографическом сервисе.</Text></Box>
              <Text size="xs" c="rgba(255,255,255,0.64)">Ищите любой населённый пункт или участок трассы по России. Цены и фактическое наличие показываются только от подтверждённого поставщика.</Text>
            </Stack>
            <Paper className="fuel-map-hero__control" radius="lg" p="md" withBorder>
              <Text size="xs" fw={750} tt="uppercase" c="gray.6" mb={6}>Населённый пункт или трасса</Text>
              <Box component="form" onSubmit={handlePlaceSearch}><TextInput aria-label="Введите населённый пункт или трассу" placeholder="Например: Уфа или М-5 Урал" value={placeQuery} onChange={(event) => setPlaceQuery(event.currentTarget.value)} rightSection={<ActionIcon type="submit" size="sm" variant="subtle" color="indigo" aria-label="Открыть место на карте"><IconSearch size={16} /></ActionIcon>} /></Box>
              <Text size="xs" fw={750} tt="uppercase" c="gray.6" mt="sm" mb={6}>Быстрый выбор города</Text>
              <Select aria-label="Выберите город" data={FUEL_MAP_CITIES.map((value) => ({ value, label: value }))} value={place ? null : city} onChange={handleCityChange} searchable size="sm" placeholder="Выберите город" />
              <Text size="xs" fw={750} tt="uppercase" c="gray.6" mt="sm" mb={6}>Показать топливо</Text>
              <Select aria-label="Выберите тип топлива" data={FUEL_FILTERS} value={fuelFilter} onChange={(value) => setFuelFilter(value || "")} size="sm" />
              <Text size="xs" fw={750} tt="uppercase" c="gray.6" mt="sm" mb={6}>Сеть АЗС</Text>
              <Select aria-label="Выберите сеть АЗС" data={networkFilters} value={networkFilter} onChange={(value) => setNetworkFilter(value || "")} size="sm" searchable nothingFoundMessage="Сеть не найдена" />
            </Paper>
          </Group>
        </Paper>

        <Group justify="space-between" align="center" gap="sm" wrap="wrap">
          <Group gap="sm"><ThemeIcon variant="light" color="indigo" radius="md"><IconMapPin size={18} /></ThemeIcon><Box><Text fw={750}>{isViewingMapArea ? "Заправки на выбранном участке" : `Заправки рядом с ${areaLabel}`}</Text><Text size="xs" c="dimmed">{data ? `${filteredStations.length} из ${data.stations.length} точек в подборке${data.coverage.dataMode === "LIVE" ? " · статусы от поставщика" : " · справочник OSM"}` : "Загружаем точки"}</Text></Box></Group>
          <Group gap="xs"><Button variant="light" color="indigo" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => mutate()} loading={isLoading || isValidating}>Обновить</Button><Button color="indigo" size="xs" leftSection={<IconMapPin size={14} />} onClick={() => setRequestedCoordinates(viewportCoordinates)} loading={isLoading || isValidating}>Загрузить этот участок</Button></Group>
        </Group>

        {error ? <AsyncErrorState title="Не удалось получить точки АЗС" description="Картографический источник временно недоступен. Повторите попытку позже." onRetry={() => mutate()} /> : (
          <SimpleGrid cols={{ base: 1, lg: 5 }} spacing="md">
            <Box style={{ gridColumn: "span 3" }}><FuelStationMap city={areaLabel} coordinates={coordinates} stations={filteredStations} selectedStation={selectedStation} onSelect={setSelectedStation} onViewportChange={setViewportCoordinates} /></Box>
            <Paper className="fuel-map-list" radius="lg" p="sm" withBorder style={{ gridColumn: "span 2" }}>
              {isLoading ? <Center h={460}><Loader size="sm" color="indigo" /></Center> : filteredStations.length ? <Stack gap="xs">
                {selectedStationInResults && <Box className="fuel-map-list__selection" aria-live="polite"><Text size="xs" fw={800} tt="uppercase" c="indigo.7">Выбранная АЗС</Text><FuelStationCard station={selectedStationInResults} referenceCoordinates={coordinates} isSelected onShowOnMap={showStationOnMap} /></Box>}
                {listedStations.map((station) => (
                <FuelStationCard
                  key={`${station.sourceType}-${station.id}`}
                  station={station}
                  referenceCoordinates={coordinates}
                  isSelected={selectedStation?.id === station.id && selectedStation.sourceType === station.sourceType}
                  onShowOnMap={showStationOnMap}
                />
              ))}{hasMoreStations && <Button variant="light" color="indigo" size="xs" fullWidth onClick={() => setVisibleStationCount((current) => current + STATION_LIST_PAGE_SIZE)}>Показать ещё {Math.min(STATION_LIST_PAGE_SIZE, filteredStations.length - displayedStations.length)} из {filteredStations.length}</Button>}</Stack> : <Center h={460}><Stack align="center" gap="xs"><ThemeIcon variant="light" color="gray" size={44} radius="xl"><IconGasStation size={22} /></ThemeIcon><Text fw={700}>Точки не найдены</Text><Text size="xs" c="dimmed" ta="center">Выберите другой тип топлива, город или обновите данные.</Text></Stack></Center>}
            </Paper>
          </SimpleGrid>
        )}

        <Paper radius="lg" p="md" withBorder className="fuel-map-note"><Group gap="sm" align="flex-start" wrap="nowrap"><ThemeIcon variant="light" color="cyan" radius="md"><IconMapPin size={18} /></ThemeIcon><Stack gap={2}><Text size="sm" c="dimmed">{data?.disclaimer || "Точки и открытые теги предоставлены OpenStreetMap. Ассортимент, цены и наличие топлива уточняйте на АЗС."}</Text>{data?.coverage.dataMode === "LIVE" && data.coverage.providerAttributionUrl && <Anchor size="xs" href={data.coverage.providerAttributionUrl} target="_blank" rel="noreferrer">Данные об АЗС: Заправкин</Anchor>}</Stack></Group></Paper>
      </Stack>
    </Box>
  )
}
