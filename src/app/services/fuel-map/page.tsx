"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"
import useSWR from "swr"
import { ActionIcon, Anchor, Badge, Box, Button, Center, Group, Image, Loader, Paper, Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Tooltip, UnstyledButton } from "@mantine/core"
import { IconCheck, IconClock, IconExternalLink, IconGasStation, IconMapPin, IconMinus, IconPlus, IconRefresh, IconRoute, IconSearch, IconX } from "@tabler/icons-react"
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

function getStationSourceLabel(station: FuelStation) {
  if (station.dataSource === "MERGED") return { label: "OSM + поставщик", color: "indigo" }
  if (station.dataSource === "ZAPRAVKIN") return { label: "Поставщик", color: "indigo" }
  return { label: "Справочник OSM", color: "gray" }
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

function getStationFuelRows(station: FuelStation) {
  const priceByFuel = new Map(station.prices.map((price) => [price.fuel, price]))
  return Array.from(new Set([...station.fuels, ...station.prices.map((price) => price.fuel)]))
    .map((fuel) => ({ fuel, price: priceByFuel.get(fuel)?.price ?? null, updatedAt: priceByFuel.get(fuel)?.updatedAt ?? null }))
}

function getFuelAvailabilityPresentation(station: FuelStation) {
  if (station.status === "FUEL") return { label: "Есть", description: "подтверждено поставщиком", color: "teal", icon: <IconCheck size={14} /> }
  if (station.status === "NO_FUEL") return { label: "Нет", description: "сообщил поставщик", color: "red", icon: <IconX size={14} /> }
  return { label: "Нет live-статуса", description: "остаток не опубликован", color: "gray", icon: <IconClock size={14} /> }
}

function FuelStationMap({ city, coordinates, stations, selectedStation, selectedStationAddress, onSelect, onViewportChange }: {
  city: string
  coordinates: { latitude: number; longitude: number }
  stations: FuelStation[]
  selectedStation: FuelStation | null
  selectedStationAddress: string | null
  onSelect: (station: FuelStation) => void
  onViewportChange: (coordinates: { latitude: number; longitude: number }) => void
}) {
  const [zoom, setZoom] = useState(11)
  const [viewportCenter, setViewportCenter] = useState(coordinates)
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

  useEffect(() => {
    const nextCenter = { latitude: coordinates.latitude, longitude: coordinates.longitude }
    setViewportCenter(nextCenter)
    viewportCenterRef.current = nextCenter
    setZoom(11)
  }, [coordinates.latitude, coordinates.longitude])

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
    if (zoom > 11) return visibleStations.map(({ station, left, top }) => ({ left, top, stations: [station] }))

    const clusters = new Map<string, MapMarker>()
    visibleStations.forEach(({ station, left, top }) => {
      const key = `${Math.round(left / 56)}:${Math.round(top / 56)}`
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
    <Paper id="fuel-station-map" className="fuel-map-canvas" radius="lg" withBorder>
      <Box ref={mapInteractionRef} className={`fuel-map-canvas__tiles${isDragging ? " is-dragging" : ""}`} aria-label={`Интерактивная карта точек АЗС: ${city}. Стрелки перемещают карту, плюс и минус меняют масштаб.`} role="region" tabIndex={0} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onKeyDown={handleKeyDown}>
        <Box className="fuel-map-canvas__tile-layer" aria-hidden="true">
        {tiles.map((tile) => (
          <Image key={tile.key} src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`} style={{ left: tile.left, top: tile.top }} alt="" aria-hidden="true" />
        ))}
        </Box>
        {markers.map((marker, index) => {
          const isCluster = marker.stations.length > 1
          const firstStation = marker.stations[0]
          const dataQuality = getStationDataQuality(firstStation)
          const networkIdentity = getNetworkIdentity(firstStation)
          const isSelected = marker.stations.some((station) => selectedStation?.id === station.id && selectedStation.sourceType === station.sourceType)
          const label = isCluster ? `${marker.stations.length} АЗС — приблизить карту` : `Показать ${firstStation.name}: ${getStationDataSummary(firstStation)}`
          return <UnstyledButton key={isCluster ? `cluster-${index}` : firstStation.id} className="fuel-map-marker" data-cluster={isCluster || undefined} data-quality={isCluster ? "cluster" : dataQuality} data-selected={isSelected || undefined} style={{ left: marker.left, top: marker.top, ...(networkIdentity && !isCluster ? { backgroundColor: networkIdentity.color, color: networkIdentity.textColor } : {}) }} onPointerDown={(event) => event.stopPropagation()} onClick={() => handleMarkerClick(marker)} aria-label={label} title={isCluster ? `${marker.stations.length} АЗС` : `${firstStation.name} · ${getStationDataSummary(firstStation)}`}>{isCluster ? marker.stations.length : networkIdentity ? <span className="fuel-map-marker__network">{networkIdentity.shortLabel}</span> : <IconGasStation size={15} />}</UnstyledButton>
        })}
      </Box>
      <Group className="fuel-map-canvas__controls" gap={4}>
        <Tooltip label="Уменьшить масштаб"><ActionIcon variant="white" color="dark" size="sm" radius="md" onClick={() => updateZoom(zoom - 1)} aria-label="Уменьшить масштаб карты"><IconMinus size={15} /></ActionIcon></Tooltip>
        <Tooltip label="Увеличить масштаб"><ActionIcon variant="white" color="dark" size="sm" radius="md" onClick={() => updateZoom(zoom + 1)} aria-label="Увеличить масштаб карты"><IconPlus size={15} /></ActionIcon></Tooltip>
      </Group>
      <Box className="fuel-map-canvas__caption"><IconMapPin size={14} /><Text size="xs">{visibleStations.length} точек · тяните карту, масштабируйте колесом</Text></Box>
      <Box className="fuel-map-canvas__legend" aria-label="Обозначения точек на карте"><Text component="span" data-quality="live">Есть live-данные</Text><Text component="span" data-quality="fuel">Топливо отмечено</Text><Text component="span" data-quality="network">Сеть указана</Text><Text component="span" data-quality="basic">Без тегов</Text></Box>
      {clusterHint && <Paper className="fuel-map-cluster-hint" radius="md" p="xs" withBorder aria-live="polite"><Text size="xs" fw={650}>{clusterHint}</Text><Button size="compact-xs" variant="subtle" color="indigo" onClick={() => setClusterHint(null)}>Понятно</Button></Paper>}
      {selectedStation && <Paper className="fuel-map-selected" radius="md" p="xs" withBorder aria-live="polite"><Group justify="space-between" gap="xs" wrap="nowrap"><Text size="xs" fw={750} lineClamp={1}>{selectedStation.name}</Text><Badge size="xs" color={getStationStatus(selectedStation).color} variant="light">{getStationStatus(selectedStation).label}</Badge></Group><Text size="10px" c="dimmed" lineClamp={1}>{selectedStation.address || selectedStationAddress || getStationNetwork(selectedStation) || "Уточняем адрес по OSM…"}</Text><Group gap={4} mt={4} wrap="wrap">{selectedStation.prices.length ? selectedStation.prices.slice(0, 3).map((price) => <Badge key={price.fuel} size="xs" color="teal" variant="light">{price.fuel}{formatFuelPrice(price.price) ? ` · ${formatFuelPrice(price.price)} ₽` : ""}</Badge>) : selectedStation.fuels.length ? selectedStation.fuels.slice(0, 4).map((fuel) => <Badge key={fuel} size="xs" color="teal" variant="light">{fuel}</Badge>) : <Badge size="xs" color="gray" variant="light">Ассортимент не указан</Badge>}</Group><Text size="10px" c="indigo.7" mt={3} lineClamp={1}>{formatStationTimestamp(selectedStation.statusUpdatedAt) ? `Обновлено: ${formatStationTimestamp(selectedStation.statusUpdatedAt)}` : selectedStation.fuels.length ? "Топливо отмечено в OpenStreetMap" : getStationDataSummary(selectedStation)}</Text></Paper>}
    </Paper>
  )
}

function FuelStationCard({ station, isSelected, resolvedAddress, isAddressLoading, onShowOnMap }: {
  station: FuelStation
  isSelected: boolean
  resolvedAddress?: string | null
  isAddressLoading?: boolean
  onShowOnMap: (station: FuelStation) => void
}) {
  const dataQuality = getStationDataQuality(station)
  const network = getStationNetwork(station)
  const networkIdentity = getNetworkIdentity(station)
  const networkLabel =
    network && network.toLocaleLowerCase("ru-RU") !== station.name.toLocaleLowerCase("ru-RU") ? network : null
  const stationStatus = getStationStatus(station)
  const sourceLabel = getStationSourceLabel(station)
  const iconColor = dataQuality === "live" ? stationStatus.color : dataQuality === "fuel" ? "teal" : dataQuality === "network" ? "orange" : "gray"
  const statusUpdated = formatStationTimestamp(station.statusUpdatedAt)
  const displayAddress = station.address || resolvedAddress
  const selectStation = () => onShowOnMap(station)

  return (
    <Paper
      className="fuel-station-card"
      data-selected={isSelected || undefined}
      radius="md"
      p="sm"
      withBorder
      onClick={selectStation}
      data-clickable
    >
      <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant={networkIdentity ? "filled" : "light"} color={iconColor} radius="md" style={networkIdentity ? { backgroundColor: networkIdentity.color, color: networkIdentity.textColor } : undefined}>{networkIdentity ? networkIdentity.shortLabel : <IconGasStation size={17} />}</ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Text fw={750} size="sm" lineClamp={1}>{station.name}</Text>
            <Text size="xs" c="dimmed" lineClamp={2}>{displayAddress || (isAddressLoading ? "Уточняем адрес по OSM…" : "Адрес не указан")}</Text>
          </Box>
        </Group>
        {station.sourceType !== "provider" && <Anchor href={`https://www.openstreetmap.org/${station.sourceType}/${station.id.replace(/^osm-[^-]+-/, "")}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} aria-label={`Открыть ${station.name} в OpenStreetMap`}><IconExternalLink size={16} /></Anchor>}
      </Group>
      <Group mt={8} gap={5} wrap="wrap">
        {networkLabel && <Badge size="xs" variant={networkIdentity ? "filled" : "outline"} color="orange" style={networkIdentity ? { backgroundColor: networkIdentity.color, color: networkIdentity.textColor } : undefined}>{networkLabel}</Badge>}
        <Badge size="xs" variant="light" color={stationStatus.color}>{stationStatus.label}</Badge>
        <Badge size="xs" variant="outline" color={sourceLabel.color}>{sourceLabel.label}</Badge>
        {station.prices.length
          ? station.prices.map((price) => <Badge key={`${price.fuel}-${price.price}`} size="xs" variant="light" color="teal">{price.fuel}{formatFuelPrice(price.price) ? ` · ${formatFuelPrice(price.price)} ₽` : ""}</Badge>)
          : station.fuels.length
            ? station.fuels.map((fuel) => <Badge key={fuel} size="xs" variant="light" color="teal">{fuel}</Badge>)
            : <Badge size="xs" variant="outline" color="gray">Ассортимент не указан</Badge>}
        {station.openingHours && <Badge size="xs" variant="outline" color="gray">{station.openingHours}</Badge>}
        {isSelected && !station.address && resolvedAddress && <Badge size="xs" variant="outline" color="blue">Адрес OSM</Badge>}
      </Group>
      <Text size="10px" c="dimmed" mt={7}>{statusUpdated ? `Данные обновлены: ${statusUpdated}` : getStationDataSummary(station)}</Text>
      <Group mt={8} gap={4}>
        <Button variant="subtle" color="indigo" size="compact-xs" onClick={(event) => { event.stopPropagation(); selectStation() }} leftSection={<IconMapPin size={13} />}>На карте</Button>
        <Button component="a" href={`https://www.openstreetmap.org/directions?from=&to=${station.latitude}%2C${station.longitude}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} variant="subtle" color="indigo" size="compact-xs" leftSection={<IconRoute size={13} />}>Маршрут</Button>
      </Group>
    </Paper>
  )
}

function FuelStationDetails({ station, resolvedAddress, isAddressLoading, onShowOnMap }: {
  station: FuelStation
  resolvedAddress: string | null
  isAddressLoading: boolean
  onShowOnMap: (station: FuelStation) => void
}) {
  const network = getStationNetwork(station)
  const source = getStationSourceLabel(station)
  const stationStatus = getStationStatus(station)
  const fuelRows = getStationFuelRows(station)
  const availability = getFuelAvailabilityPresentation(station)
  const displayAddress = station.address || resolvedAddress
  const statusUpdated = formatStationTimestamp(station.statusUpdatedAt)

  return (
    <Paper radius="lg" p="md" withBorder style={{ borderColor: "#a5b4fc", background: "linear-gradient(135deg, #eef2ff 0%, #fff 56%)" }}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="indigo" variant="light" radius="md" size="lg"><IconGasStation size={20} /></ThemeIcon>
            <Box style={{ minWidth: 0 }}><Text fw={800} c="dark.9" lineClamp={2}>{station.name}</Text><Text size="xs" c="dimmed">{network || "АЗС"} · {source.label}</Text></Box>
          </Group>
          <Badge color={stationStatus.color} variant="light">{stationStatus.label}</Badge>
        </Group>

        <Paper radius="md" p="sm" withBorder style={{ background: "rgba(255,255,255,.78)" }}>
          <Group gap="xs" align="flex-start" wrap="nowrap"><ThemeIcon size="sm" radius="xl" color="indigo" variant="light"><IconMapPin size={14} /></ThemeIcon><Box><Text size="xs" c="dimmed">Адрес</Text><Text size="sm" fw={600}>{displayAddress || (isAddressLoading ? "Уточняем адрес по OpenStreetMap…" : "Адрес не опубликован")}</Text></Box></Group>
        </Paper>

        <Box>
          <Group justify="space-between" mb={6}><Text size="sm" fw={750}>Топливо и наличие</Text><Badge size="xs" color={availability.color} variant="light">{availability.description}</Badge></Group>
          {fuelRows.length ? <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">{fuelRows.map((fuel) => (
            <Paper key={fuel.fuel} radius="md" p="xs" withBorder style={{ background: "rgba(255,255,255,.78)" }}>
              <Group justify="space-between" gap="xs" wrap="nowrap"><Text fw={700} size="sm">{fuel.fuel}</Text><Badge size="xs" color={availability.color} variant="light" leftSection={availability.icon}>{availability.label}</Badge></Group>
              <Text size="xs" c="dimmed" mt={3}>{formatFuelPrice(fuel.price) ? `${formatFuelPrice(fuel.price)} ₽/л` : station.status === "UNKNOWN" ? "Цена не опубликована" : "Цена не опубликована поставщиком"}</Text>
            </Paper>
          ))}</SimpleGrid> : <Paper radius="md" p="sm" withBorder style={{ background: "rgba(255,255,255,.78)" }}><Text size="sm" c="dimmed">Типы топлива не опубликованы этой точкой.</Text></Paper>}
          <Text size="xs" c="dimmed" mt={6}>{station.status === "UNKNOWN" ? "Это справочная точка: не считаем отсутствие live-статуса отсутствием топлива." : `${statusUpdated ? `Данные поставщика: ${statusUpdated}. ` : "Данные поставщика без времени обновления. "}Наличие уточняйте перед поездкой.`}</Text>
        </Box>

        <Group gap="xs" wrap="wrap">
          <Button size="compact-sm" color="indigo" variant="light" leftSection={<IconMapPin size={14} />} onClick={() => onShowOnMap(station)}>Показать на карте</Button>
          <Button component="a" href={`https://www.openstreetmap.org/directions?from=&to=${station.latitude}%2C${station.longitude}`} target="_blank" rel="noreferrer" size="compact-sm" color="indigo" variant="light" leftSection={<IconRoute size={14} />}>Маршрут</Button>
          {station.openingHours && <Badge variant="outline" color="gray" leftSection={<IconClock size={12} />}>{station.openingHours}</Badge>}
          {station.sourceType !== "provider" && <Anchor href={`https://www.openstreetmap.org/${station.sourceType}/${station.id.replace(/^osm-[^-]+-/, "")}`} target="_blank" rel="noreferrer" size="xs">Источник OSM</Anchor>}
        </Group>
      </Stack>
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
  const isViewingMapArea = Boolean(requestedCoordinates)
  const hasUnloadedMapArea = getDistanceInKilometers(coordinates, viewportCoordinates) > 0.35
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
  const displayedStations = filteredStations.slice(0, visibleStationCount)
  const hasMoreStations = displayedStations.length < filteredStations.length
  const selectedStationKey = selectedStation ? `${selectedStation.sourceType}-${selectedStation.id}` : null
  const selectedAddress = selectedStation?.address
  const selectedAddressLatitude = selectedStation?.latitude
  const selectedAddressLongitude = selectedStation?.longitude
  const selectedStationAddressUrl = useMemo(() => {
    if (selectedAddress || selectedAddressLatitude == null || selectedAddressLongitude == null) return null
    const params = new URLSearchParams({ detail: "address", latitude: selectedAddressLatitude.toFixed(6), longitude: selectedAddressLongitude.toFixed(6) })
    return `/api/fuel-stations?${params.toString()}`
  }, [selectedAddress, selectedAddressLatitude, selectedAddressLongitude])
  const { data: selectedStationAddressData, isLoading: isStationAddressLoading } = useSWR<FuelStationAddressResponse>(selectedStationAddressUrl, fetchJson, { revalidateOnFocus: false })
  const selectedStationAddress = selectedStation?.address || selectedStationAddressData?.address || null
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

  const handleRefresh = () => setLiveRefreshTimestamp(Date.now())

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
          <Group gap="xs"><Button variant="light" color="indigo" size="xs" leftSection={<IconRefresh size={14} />} onClick={handleRefresh} loading={isLoading || isValidating}>Обновить</Button><Button color={hasUnloadedMapArea ? "indigo" : "gray"} variant={hasUnloadedMapArea ? "filled" : "light"} size="xs" leftSection={<IconMapPin size={14} />} onClick={() => setRequestedCoordinates(viewportCoordinates)} loading={isLoading || isValidating}>{hasUnloadedMapArea ? "Загрузить текущий участок" : "Участок загружен"}</Button></Group>
        </Group>

        {data && <Paper radius="md" p="sm" withBorder><Group justify="space-between" gap="xs" wrap="wrap"><Group gap="xs"><Badge size="sm" variant="light" color={data.coverage.dataMode === "LIVE" ? (data.coverage.liveDataStale ? "orange" : "teal") : "gray"}>{data.coverage.dataMode === "LIVE" ? (data.coverage.liveDataStale ? "Последние live-данные" : "Live: цены и наличие") : "Справочный режим"}</Badge><Text size="xs" c="dimmed">{data.coverage.dataMode === "LIVE" ? (data.coverage.liveDataStale ? "Поставщик временно недоступен — показываем последнюю сохранённую выборку." : "Цены, наличие и время обновления получены от поставщика.") : data.coverage.liveProviderConfigured ? "Поставщик временно не вернул данные для участка." : "Подключите официальный API-ключ, чтобы видеть цены и наличие; точки уже доступны из OSM."}</Text></Group>{data.coverage.rateLimitRemaining !== null && <Badge size="xs" color="gray" variant="outline">API: осталось {data.coverage.rateLimitRemaining.toLocaleString("ru-RU")} из {data.coverage.rateLimitLimit?.toLocaleString("ru-RU") || "лимита"}</Badge>}</Group></Paper>}
        {hasUnloadedMapArea && <Paper radius="md" p="sm" withBorder style={{ borderColor: "var(--mantine-color-indigo-2)", background: "var(--mantine-color-indigo-0)" }}><Group gap="xs" wrap="nowrap"><ThemeIcon size="sm" radius="xl" color="indigo" variant="light"><IconMapPin size={14} /></ThemeIcon><Text size="sm" c="indigo.9">Вы переместили карту. Загрузите текущий участок, чтобы обновить список АЗС, расстояния и доступные справочные данные.</Text></Group></Paper>}

        {error ? <AsyncErrorState title="Не удалось получить точки АЗС" description="Картографический источник временно недоступен. Повторите попытку позже." onRetry={() => mutate()} /> : (
          <SimpleGrid cols={{ base: 1, lg: 5 }} spacing="md">
            <Box style={{ gridColumn: "span 3" }}><FuelStationMap city={areaLabel} coordinates={coordinates} stations={filteredStations} selectedStation={selectedStation} selectedStationAddress={selectedStationAddress} onSelect={setSelectedStation} onViewportChange={setViewportCoordinates} /></Box>
            <Paper className="fuel-map-list" radius="lg" p="sm" withBorder style={{ gridColumn: "span 2" }}>
              {isLoading ? <Center h={460}><Loader size="sm" color="indigo" /></Center> : filteredStations.length ? <Stack gap="xs">
                {selectedStation && <Box className="fuel-map-list__selection" aria-live="polite"><Group justify="space-between" gap="xs" mb={4}><Text size="xs" fw={800} tt="uppercase" c="indigo.7">Карточка АЗС</Text><Button size="compact-xs" variant="subtle" color="gray" onClick={() => setSelectedStation(null)}>Скрыть</Button></Group><FuelStationDetails station={selectedStation} resolvedAddress={selectedStationAddress} isAddressLoading={isStationAddressLoading} onShowOnMap={showStationOnMap} /></Box>}
                {listedStations.map((station) => (
                <FuelStationCard
                  key={`${station.sourceType}-${station.id}`}
                  station={station}
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
