"use client"
export const dynamic = "force-dynamic"
import { useState, useMemo } from "react"
import useSWR from "swr"
import Link from "next/link"
import NextImage from "next/image"
import { Box, Text, Select, Group, Pagination, Center, Loader, Stack, SegmentedControl, Paper, TextInput, Button, SimpleGrid, Badge, Collapse, Anchor, Divider, Chip } from "@mantine/core"
import { IconLayoutGrid, IconList, IconSearch, IconAdjustmentsHorizontal, IconX, IconChevronDown, IconGasStation, IconManualGearbox, IconCar, IconEngine, IconPalette, IconBolt, IconTruck, IconTractor, IconSpeedboat, IconPlane, IconArrowUpRight, IconRoute, IconShieldCheck } from "@tabler/icons-react"
import ListingCard from "@/components/listings/ListingCard"
import ListingRow from "@/components/listings/ListingRow"
import { getModels, POPULAR_BRANDS } from "@/lib/catalog"
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, DRIVE_TYPES, CONDITIONS, POPULAR_CITIES, SORT_OPTIONS, STEERING_WHEELS, DOCUMENT_STATUSES, DAMAGE_INFO, SELLER_TYPES, AVAILABILITY_TYPES, OWNERS_COUNT_OPTIONS, MOTORCYCLE_TYPES, TRUCK_BODY_TYPES, TRUCK_AXLE_FORMULAS, SPECIAL_TYPES, WATER_TYPES, HULL_MATERIALS, AIR_TYPES } from "@/lib/constants"

const fetcher = (url) => fetch(url).then((r) => r.json())
const CAR_COLORS = ["Белый","Чёрный","Серебристый","Серый","Синий","Красный","Зелёный","Коричневый","Бордовый","Золотистый","Жёлтый","Оранжевый"]

export default function HomePage(p) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [view, setView] = useState("grid")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [make, setMake] = useState(null)
  const [model, setModel] = useState(null)
  const [sort, setSort] = useState("newest")
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")
  const [yearFrom, setYearFrom] = useState(null)
  const [yearTo, setYearTo] = useState(null)
  const [city, setCity] = useState(null)
  const [mileageTo, setMileageTo] = useState("")
  const [transmission, setTransmission] = useState(null)
  const [fuelType, setFuelType] = useState([])
  const [driveType, setDriveType] = useState(null)
  const [bodyType, setBodyType] = useState([])
  const [engineVolumeFrom, setEngineVolumeFrom] = useState("")
  const [engineVolumeTo, setEngineVolumeTo] = useState("")
  const [powerFrom, setPowerFrom] = useState("")
  const [powerTo, setPowerTo] = useState("")
  const [color, setColor] = useState(null)
  const [condition, setCondition] = useState([])
  const [steeringWheel, setSteeringWheel] = useState(null)
  const [documentsStatus, setDocumentsStatus] = useState(null)
  const [damageInfo, setDamageInfo] = useState(null)
  const [sellerType, setSellerType] = useState(null)
  const [availability, setAvailability] = useState(null)
  const [customsCleared, setCustomsCleared] = useState(null)
  const [ownersCountFrom, setOwnersCountFrom] = useState("")
  const [ownersCountTo, setOwnersCountTo] = useState("")
  const [mileageFrom, setMileageFrom] = useState("")
  const [keywords, setKeywords] = useState("")

  const brandOptions = POPULAR_BRANDS.slice(0,80).map((b) => ({ value: b.name, label: b.name }))
  const modelOptions = make ? getModels(make).map((m) => ({ value: m, label: m })) : []
  const { data: stats } = useSWR("/api/stats", fetcher)
  const auctionStats = stats || { auctions: 0, auctionByCountry: {} }

  const yearData = Array.from({length:35},(_,i) => ({ value: String(2024-i), label: String(2024-i) }))

  const vt = p.initialVehicleType || "CAR"

  const buildQuery = () => {
    const q = new URLSearchParams()
    q.set("type", p.initialType || "vehicle")
    if (p.initialVehicleType) q.set("vehicleType", p.initialVehicleType)
    q.set("page", page)
    q.set("limit", "18")
    q.set("sort", sort)
    if(query) q.set("q", query)
    if(make) q.set("make", make)
    if(model) q.set("model", model)
    if(city) q.set("city", city)
    if(priceFrom) q.set("priceFrom", priceFrom)
    if(priceTo) q.set("priceTo", priceTo)
    if(yearFrom) q.set("yearFrom", yearFrom)
    if(yearTo) q.set("yearTo", yearTo)
    if(mileageTo) q.set("mileageTo", mileageTo)
    if(transmission) q.set("transmission", transmission)
    if(fuelType.length) q.set("fuelType", fuelType.join(","))
    if(driveType) q.set("driveType", driveType)
    if(bodyType.length) q.set("bodyType", bodyType.join(","))
    if(engineVolumeFrom) q.set("engineVolumeFrom", engineVolumeFrom)
    if(engineVolumeTo) q.set("engineVolumeTo", engineVolumeTo)
    if(powerFrom) q.set("powerFrom", powerFrom)
    if(powerTo) q.set("powerTo", powerTo)
    if(color) q.set("color", color)
    if(condition.length) q.set("condition", condition.join(","))
    if(steeringWheel) q.set("steeringWheel", steeringWheel)
    if(documentsStatus) q.set("documentsStatus", documentsStatus)
    if(damageInfo) q.set("damageInfo", damageInfo)
    if(sellerType) q.set("sellerType", sellerType)
    if(availability) q.set("availability", availability)
    if(customsCleared !== null) q.set("customsCleared", String(customsCleared))
    if(ownersCountFrom) q.set("ownersCountFrom", ownersCountFrom)
    if(ownersCountTo) q.set("ownersCountTo", ownersCountTo)
    if(mileageFrom) q.set("mileageFrom", mileageFrom)
    if(keywords) q.set("keywords", keywords)
    return q.toString()
  }

  const { data, isLoading } = useSWR("/api/listings?" + buildQuery(), fetcher)

  const resetFilters = () => {
    setMake(null); setModel(null); setPriceFrom(""); setPriceTo("")
    setYearFrom(null); setYearTo(null); setCity(null); setMileageTo("")
    setTransmission(null); setFuelType([]); setDriveType(null); setBodyType([])
    setEngineVolumeFrom(""); setEngineVolumeTo(""); setPowerFrom(""); setPowerTo("")
    setColor(null); setCondition([])
    setSteeringWheel(null); setDocumentsStatus(null); setDamageInfo(null)
    setSellerType(null); setAvailability(null); setCustomsCleared(null)
    setOwnersCountFrom(""); setOwnersCountTo(""); setMileageFrom("")
    setKeywords("")
    setQuery(""); setPage(1)
  }

  const activeFilterCount = (make?1:0)+(model?1:0)+(priceFrom?1:0)+(priceTo?1:0)+(yearFrom?1:0)+(yearTo?1:0)+(city?1:0)+(mileageTo?1:0)+(transmission?1:0)+(fuelType.length?1:0)+(driveType?1:0)+(bodyType.length?1:0)+(engineVolumeFrom?1:0)+(engineVolumeTo?1:0)+(powerFrom?1:0)+(powerTo?1:0)+(color?1:0)+(condition.length?1:0)+(steeringWheel?1:0)+(documentsStatus?1:0)+(damageInfo?1:0)+(sellerType?1:0)+(availability?1:0)+(customsCleared!==null?1:0)+(ownersCountFrom?1:0)+(ownersCountTo?1:0)+(mileageFrom?1:0)+(keywords?1:0)

  return (
    <Box p={{base:"sm",md:"md"}}><Stack gap="md">
      {!p.categorySlug && (
        <Paper className="market-directory" radius="lg" p={{ base: "md", md: "lg" }} withBorder>
          <Group justify="space-between" align="flex-start" gap="xl" wrap="wrap">
            <Box maw={520}>
              <Badge variant="light" color="indigo" size="sm" mb={8}>Авторынок</Badge>
              <Text component="h1" ff="var(--font-display),sans-serif" fw={800} fz={{ base: 24, md: 30 }} c="dark.9" lh={1.12}>Транспорт и запчасти без лишних шагов</Text>
              <Text size="sm" c="dimmed" mt={6}>Начните с категории или перейдите к международным аукционам — все основные действия остаются в одном экране.</Text>
            </Box>
            <Group gap="xs" className="market-directory__signals">
              <Group gap={6} wrap="nowrap"><IconShieldCheck size={17} color="#059669" /><Text size="xs" fw={600}>Проверка продавцов</Text></Group>
              <Group gap={6} wrap="nowrap"><IconRoute size={17} color="#4f46e5" /><Text size="xs" fw={600}>Доставка под ключ</Text></Group>
            </Group>
          </Group>
          <Divider my="md" />
          <Stack gap={10}>
            <Group gap="xs" wrap="wrap">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase" w={82}>Транспорт</Text>
              {[{l:"Легковые",h:"/category/cars"},{l:"Мото",h:"/category/moto"},{l:"Грузовики",h:"/category/trucks"},{l:"Спецтехника",h:"/category/special"},{l:"Вода",h:"/category/water"},{l:"Авиа",h:"/category/air"}].map((c) => (
                <Button key={c.h} component={Link} href={c.h} variant="default" color="gray" size="xs" radius="md">{c.l}</Button>
              ))}
            </Group>
            <Group gap="xs" wrap="wrap">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase" w={82}>Запчасти</Text>
              {[{l:"Все запчасти",h:"/parts-finder"},{l:"Двигатель",h:"/parts-finder?partType=ENGINE"},{l:"Тормоза",h:"/parts-finder?partType=BRAKES"},{l:"Подвеска",h:"/parts-finder?partType=SUSPENSION"},{l:"Оптика",h:"/parts-finder?partType=LIGHTING"},{l:"Электрика",h:"/parts-finder?partType=ELECTRICAL"}].map((c) => (
                <Button key={c.h} component={Link} href={c.h} variant="subtle" color="indigo" size="xs" radius="md">{c.l}</Button>
              ))}
            </Group>
          </Stack>
        </Paper>)}

      {/* Аукционы мира */}
      {!p.categorySlug && (
        <Paper className="home-auctions home-auctions--primary" radius="lg" p={{base:"lg",md:"xl"}}>
          <NextImage src="/images/home/automarket-hero.png" alt="Авторынок — международные аукционы транспорта" fill priority sizes="(max-width: 768px) 100vw, 1200px" className="home-auctions__image" />
          <Box className="home-auctions__scrim" />
          <Box className="home-auctions__content">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
              <Box maw={590}>
                <Badge variant="light" color="orange" size="sm" mb="sm" className="home-auctions__eyebrow">МЕЖДУНАРОДНЫЕ АУКЦИОНЫ</Badge>
                <Text fw={800} fz={{base:26,md:36}} c="white" ff="var(--font-display),sans-serif">Выберите лот. Маршрут и документы — под контролем.</Text>
                <Text size="sm" c="rgba(255,255,255,0.82)" mt={8} maw={510}>{auctionStats.auctions} лотов в каталоге. До сделки видны ориентир цены, страна, путь доставки и следующий шаг.</Text>
                <Button component={Link} href="/auctions" color="orange" size="sm" radius="md" mt="lg" rightSection={<IconArrowUpRight size={16} />}>Открыть аукционы</Button>
              </Box>
              <Box className="home-auctions__summary">
                <Text size="xs" c="rgba(255,255,255,0.68)" tt="uppercase" fw={700}>Сценарий сделки</Text>
                <Stack gap={8} mt="sm">
                  <Text size="sm" c="white" fw={600}>1. Выбор и проверка лота</Text>
                  <Text size="sm" c="white" fw={600}>2. Прозрачная оплата и документы</Text>
                  <Text size="sm" c="white" fw={600}>3. Отслеживание доставки в кабинете</Text>
                </Stack>
              </Box>
              <Group gap={6} maw={680} justify="flex-start" className="home-auctions__countries">
              {[
                { flag: "🇯🇵", label: "Япония", count: auctionStats.auctionByCountry?.JP || 0, href: "/auctions?country=JP" },
                { flag: "🇰🇷", label: "Корея", count: auctionStats.auctionByCountry?.KR || 0, href: "/auctions?country=KR" },
                { flag: "🇺🇸", label: "США", count: auctionStats.auctionByCountry?.US || 0, href: "/auctions?country=US" },
                { flag: "🇩🇪", label: "Европа", count: auctionStats.auctionByCountry?.DE || 0, href: "/auctions?country=DE" },
                { flag: "🇨🇳", label: "Китай", count: auctionStats.auctionByCountry?.CN || 0, href: "/auctions?country=CN" },
              ].map((c) => (
                <Link key={c.href} href={c.href} style={{ textDecoration: "none" }}>
                  <Badge size="md" radius="md" variant="light" color="orange" className="home-auctions__chip" style={{ cursor: "pointer", padding: "8px 12px" }}>
                    {c.flag} {c.label} ({c.count})
                  </Badge>
                </Link>
              ))}
              </Group>
            </Group>
          </Box>
        </Paper>
      )}

      <Group justify="space-between" align="center">
        <Stack gap={0}>
          <Text component="h1" fw={800} fz={{base:20,md:24}} c="dark.9">{p.pageTitle || "Все объявления"}</Text>
          {data && <Text size="xs" c="gray.5">{data.pagination?.total || 0} объявлений</Text>}
        </Stack>
        <SegmentedControl className="catalog-view-switch" size="sm" value={view} onChange={(v) => setView(v)} radius="md" data={[{label:<Group gap={4} wrap="nowrap"><IconLayoutGrid size={15} stroke={1.8}/> <Text size="xs" fw={600}>Сетка</Text></Group>,value:"grid"},{label:<Group gap={4} wrap="nowrap"><IconList size={15} stroke={1.8}/> <Text size="xs" fw={600}>Список</Text></Group>,value:"list"}]} />
      </Group>

      <Paper radius="md" p="md" withBorder style={{background:"var(--mantine-color-body)"}}>
        <Stack gap="sm">
          <Box className="catalog-filter-grid">
            <TextInput className="catalog-filter-grid__search" placeholder="Марка, модель, ключевое слово" leftSection={<IconSearch size={14}/>} value={query} onChange={(e) => setQuery(e.target.value)} size="sm" />
            <Select placeholder="Марка" data={brandOptions} searchable clearable value={make} onChange={(v) => {setMake(v);setModel(null)}} size="sm" />
            <Select placeholder="Модель" data={modelOptions} searchable clearable disabled={!make} value={model} onChange={setModel} size="sm" />
            <Select data={SORT_OPTIONS.map((o) => ({value:o.value,label:o.label}))} value={sort} onChange={(v) => setSort(v || "newest")} size="sm" />
            <Box className="catalog-price-range">
              <Text size="10px" c="dimmed" fw={700} tt="uppercase">Цена, ₽</Text>
              <Group gap={4} wrap="nowrap">
                <TextInput aria-label="Цена от" placeholder="От" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} size="sm" type="number" />
                <TextInput aria-label="Цена до" placeholder="До" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} size="sm" type="number" />
              </Group>
            </Box>
            <Select placeholder="Год от" data={yearData} searchable clearable value={yearFrom} onChange={setYearFrom} size="sm" />
            <Select placeholder="Год до" data={yearData} searchable clearable value={yearTo} onChange={setYearTo} size="sm" />
            <Select placeholder="Город" data={POPULAR_CITIES.map((c) => ({value:c,label:c}))} searchable clearable value={city} onChange={setCity} size="sm" />
            <TextInput placeholder="Пробег до, км" value={mileageTo} onChange={(e) => setMileageTo(e.target.value)} size="sm" type="number" />
          </Box>

          <Group justify="space-between" align="center">
            <Button
              variant={showAdvanced ? "filled" : "light"}
              color="indigo"
              size="sm"
              radius="md"
              onClick={() => setShowAdvanced((s) => !s)}
              leftSection={<IconAdjustmentsHorizontal size={16} />}
              rightSection={
                <Group gap={6}>
                  {activeFilterCount > 0 && <Badge size="xs" circle color={showAdvanced ? "dark" : "indigo"} variant="filled" style={{ minWidth: 20, height: 20 }}>{activeFilterCount}</Badge>}
                  <IconChevronDown size={14} style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </Group>
              }
              styles={{ root: { fontWeight: 600 } }}
            >
              Расширенные фильтры
            </Button>
            {activeFilterCount > 0 && <Button variant="subtle" size="xs" color="gray" leftSection={<IconX size={14}/>} onClick={resetFilters}>Сбросить всё</Button>}
          </Group>

          <Collapse in={showAdvanced}>
            <Divider my="xs"/>
            <Stack gap="md">
              {(vt === "CAR" || vt === "TRUCK") && (
              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconManualGearbox size={14}/> Коробка передач</Text>
                  <Group gap={6}>{TRANSMISSIONS.map((t) => (
                    <Chip key={t.value} checked={transmission === t.value} onChange={() => setTransmission(transmission === t.value ? null : t.value)} variant={transmission === t.value ? "filled" : "outline"} color="indigo">{t.label}</Chip>
                  ))}</Group>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Привод</Text>
                  <Group gap={6}>{DRIVE_TYPES.map((d) => (
                    <Chip key={d.value} checked={driveType === d.value} onChange={() => setDriveType(driveType === d.value ? null : d.value)} variant={driveType === d.value ? "filled" : "outline"} color="indigo" size="md" radius="xl">{d.label}</Chip>
                  ))}</Group>
                </Box>
              </Group>
              )}

              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconGasStation size={14}/> Тип топлива</Text>
                <Group gap={6}>{FUEL_TYPES.map((f) => (
                  <Chip key={f.value} checked={fuelType.includes(f.value)} onChange={(c) => { setFuelType(c ? [...fuelType, f.value] : fuelType.filter((v) => v !== f.value)); setPage(1) }} variant={fuelType.includes(f.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{f.label}</Chip>
                ))}</Group>
              </Box>

              {/* Подтип по категории */}
              {vt === "CAR" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconCar size={14}/> Тип кузова</Text>
                <Group gap={6}>{BODY_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "MOTORCYCLE" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconCar size={14}/> Тип мотоцикла</Text>
                <Group gap={6}>{MOTORCYCLE_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "TRUCK" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconTruck size={14}/> Тип кузова / надстройки</Text>
                <Group gap={6}>{TRUCK_BODY_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "SPECIAL" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconTractor size={14}/> Тип спецтехники</Text>
                <Group gap={6}>{SPECIAL_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "WATER" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconSpeedboat size={14}/> Тип судна</Text>
                <Group gap={6}>{WATER_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "AIR" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconPlane size={14}/> Тип воздушного судна</Text>
                <Group gap={6}>{AIR_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}

              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconEngine size={14}/> Объём двигателя, л</Text>
                  <Group gap="xs" align="flex-end">
                    <TextInput placeholder="от" value={engineVolumeFrom} onChange={(e) => setEngineVolumeFrom(e.target.value)} size="sm" w={80} type="number" step="0.1"/>
                    <TextInput placeholder="до" value={engineVolumeTo} onChange={(e) => setEngineVolumeTo(e.target.value)} size="sm" w={80} type="number" step="0.1"/>
                  </Group>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconBolt size={14}/> Мощность, л.с.</Text>
                  <Group gap="xs" align="flex-end">
                    <TextInput placeholder="от" value={powerFrom} onChange={(e) => setPowerFrom(e.target.value)} size="sm" w={80} type="number"/>
                    <TextInput placeholder="до" value={powerTo} onChange={(e) => setPowerTo(e.target.value)} size="sm" w={80} type="number"/>
                  </Group>
                </Box>
              </Group>

              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconPalette size={14}/> Цвет</Text>
                  <Select placeholder="Любой" data={CAR_COLORS.map((c) => ({value:c,label:c}))} clearable searchable value={color} onChange={setColor} size="sm" w={160}/>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Состояние</Text>
                  <Group gap={6}>{CONDITIONS.map((c) => (
                    <Chip key={c.value} checked={condition.includes(c.value)} onChange={(ch) => { setCondition(ch ? [...condition, c.value] : condition.filter((v) => v !== c.value)); setPage(1) }} variant={condition.includes(c.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{c.label}</Chip>
                  ))}</Group>
                </Box>
              </Group>

              {(vt === "CAR" || vt === "TRUCK") && (
              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Руль</Text>
                  <Group gap={6}>{STEERING_WHEELS.map((sw) => (
                    <Chip key={sw.value} checked={steeringWheel === sw.value} onChange={() => setSteeringWheel(steeringWheel === sw.value ? null : sw.value)} variant={steeringWheel === sw.value ? "filled" : "outline"} color="indigo" size="md" radius="xl">{sw.label}</Chip>
                  ))}</Group>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Продавец</Text>
                  <Group gap={6}>{SELLER_TYPES.map((st) => (
                    <Chip key={st.value} checked={sellerType === st.value} onChange={() => setSellerType(sellerType === st.value ? null : st.value)} variant={sellerType === st.value ? "filled" : "outline"} color="indigo" size="md" radius="xl">{st.label}</Chip>
                  ))}</Group>
                </Box>
              </Group>
              )}

              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Документы</Text>
                  <Select placeholder="Неважно" data={DOCUMENT_STATUSES.map((d) => ({value:d.value,label:d.label}))} clearable value={documentsStatus} onChange={setDocumentsStatus} size="sm" w={170}/>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Повреждения</Text>
                  <Select placeholder="Неважно" data={DAMAGE_INFO.map((d) => ({value:d.value,label:d.label}))} clearable value={damageInfo} onChange={setDamageInfo} size="sm" w={170}/>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Наличие</Text>
                  <Select placeholder="Неважно" data={AVAILABILITY_TYPES.map((a) => ({value:a.value,label:a.label}))} clearable value={availability} onChange={setAvailability} size="sm" w={150}/>
                </Box>
              </Group>

              <Group gap="lg" wrap="wrap" align="flex-end">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Пробег, км</Text>
                  <Group gap="xs" align="flex-end">
                    <TextInput placeholder="от" value={mileageFrom} onChange={(e) => setMileageFrom(e.target.value)} size="sm" w={90} type="number"/>
                    <TextInput placeholder="до" value={mileageTo} onChange={(e) => setMileageTo(e.target.value)} size="sm" w={90} type="number"/>
                  </Group>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Владельцев, до</Text>
                  <Select placeholder="Неважно" data={OWNERS_COUNT_OPTIONS.map((o) => ({value:o.value,label:o.label}))} clearable value={ownersCountTo} onChange={setOwnersCountTo} size="sm" w={150}/>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Растаможен</Text>
                  <SegmentedControl size="sm" value={customsCleared === null ? "any" : customsCleared ? "yes" : "no"} onChange={(v) => setCustomsCleared(v === "any" ? null : v === "yes")} data={[{label:"Неважно",value:"any"},{label:"Да",value:"yes"},{label:"Нет",value:"no"}]}/>
                </Box>
              </Group>

              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6}>Ключевые слова</Text>
                <TextInput placeholder='Например: "один хозяин", RAID, ксенон...' value={keywords} onChange={(e) => setKeywords(e.target.value)} size="sm" w={400} leftSection={<IconSearch size={14}/>}/>
                <Text size={10} c="gray.4" mt={4}>Для точного совпадения используйте кавычки</Text>
              </Box>
            </Stack>
          </Collapse>
        </Stack>
      </Paper>

      {isLoading ? (
        <Center py={80}><Loader size="sm" color="indigo"/></Center>
      ) : !data?.listings?.length ? (
        <Center py={80}>
          <Stack align="center" gap="xs">
            <Text c="gray.5" fz="lg">Ничего не найдено</Text>
            <Text size="xs" c="gray.4">Попробуйте изменить фильтры</Text>
            {activeFilterCount > 0 && <Button variant="subtle" size="sm" onClick={resetFilters} mt="xs">Сбросить фильтры</Button>}
          </Stack>
        </Center>
      ) : view === "grid" ? (
        <SimpleGrid cols={{base:1,sm:2,md:3,lg:4}} spacing="sm">{data.listings.map((l) => <ListingCard key={l.id} listing={l}/>)}</SimpleGrid>
      ) : (
        <Stack gap="xs">{data.listings.map((l) => <ListingRow key={l.id} listing={l}/>)}</Stack>
      )}

      {data && data.pagination?.pages > 1 && (
        <Group justify="center"><Pagination value={page} onChange={setPage} total={data.pagination.pages} size="sm" color="indigo"/></Group>
      )}
    </Stack></Box>
  )
}
