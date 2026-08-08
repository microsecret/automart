"use client"
export const dynamic = "force-dynamic"
import { useState, useMemo } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Box, Text, Select, Group, Pagination, Center, Loader, Stack, SegmentedControl, Paper, TextInput, Button, SimpleGrid, Badge, Collapse, Anchor, Divider, Chip } from "@mantine/core"
import { IconLayoutGrid, IconList, IconSearch, IconAdjustmentsHorizontal, IconX, IconChevronDown, IconGasStation, IconManualGearbox, IconCar, IconEngine, IconPalette, IconBolt, IconTruck, IconTractor, IconSpeedboat, IconPlane } from "@tabler/icons-react"
import ListingCard from "@/components/listings/ListingCard"
import ListingRow from "@/components/listings/ListingRow"
import { getModels, POPULAR_BRANDS } from "@/lib/catalog"
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, DRIVE_TYPES, CONDITIONS, POPULAR_CITIES, SORT_OPTIONS, STEERING_WHEELS, DOCUMENT_STATUSES, DAMAGE_INFO, SELLER_TYPES, AVAILABILITY_TYPES, OWNERS_COUNT_OPTIONS, COUNTRIES_OF_ORIGIN, MOTORCYCLE_TYPES, TRUCK_BODY_TYPES, TRUCK_AXLE_FORMULAS, SPECIAL_TYPES, WATER_TYPES, HULL_MATERIALS, AIR_TYPES } from "@/lib/constants"

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
  const [countryOfOrigin, setCountryOfOrigin] = useState(null)
  const [keywords, setKeywords] = useState("")

  const brandOptions = POPULAR_BRANDS.slice(0,80).map((b) => ({ value: b.name, label: b.name }))
  const modelOptions = make ? getModels(make).map((m) => ({ value: m, label: m })) : []
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
    if(fuelType.length) q.set("fuelType", fuelType[0])
    if(driveType) q.set("driveType", driveType)
    if(bodyType.length) q.set("bodyType", bodyType[0])
    if(engineVolumeFrom) q.set("engineVolumeFrom", engineVolumeFrom)
    if(engineVolumeTo) q.set("engineVolumeTo", engineVolumeTo)
    if(powerFrom) q.set("powerFrom", powerFrom)
    if(powerTo) q.set("powerTo", powerTo)
    if(color) q.set("color", color)
    if(condition.length) q.set("condition", condition[0])
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
    setCountryOfOrigin(null); setKeywords("")
    setQuery(""); setPage(1)
  }

  const activeFilterCount = (make?1:0)+(model?1:0)+(priceFrom?1:0)+(priceTo?1:0)+(yearFrom?1:0)+(yearTo?1:0)+(city?1:0)+(mileageTo?1:0)+(transmission?1:0)+(fuelType.length?1:0)+(driveType?1:0)+(bodyType.length?1:0)+(engineVolumeFrom?1:0)+(engineVolumeTo?1:0)+(powerFrom?1:0)+(powerTo?1:0)+(color?1:0)+(condition.length?1:0)+(steeringWheel?1:0)+(documentsStatus?1:0)+(damageInfo?1:0)+(sellerType?1:0)+(availability?1:0)+(customsCleared!==null?1:0)+(ownersCountFrom?1:0)+(ownersCountTo?1:0)+(mileageFrom?1:0)+(countryOfOrigin?1:0)+(keywords?1:0)

  return (
    <Box p={{base:"sm",md:"md"}}><Stack gap="md">
      {!p.categorySlug && (
        <Paper radius="lg" p="xl" style={{background:"linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#ec4899 100%)",position:"relative",overflow:"hidden"}}>
          <Box style={{position:"relative",zIndex:1}}>
            <Text ff="var(--font-display),sans-serif" fw={800} fz={{base:24,md:32}} c="white" mb={6}>Авторынок — транспорт и запчасти</Text>
            <Text size="sm" c="rgba(255,255,255,0.9)" mb="md">300+ авто · 50+ запчастей · VIN-проверка · Безопасные сделки · Умный подбор</Text>
            <Group gap="xs" wrap="wrap" mb="sm">
              <Text size="xs" c="rgba(255,255,255,0.7)" fw={600} tt="uppercase">Транспорт:</Text>
              {[{l:"Легковые",h:"/category/cars"},{l:"Мото",h:"/category/moto"},{l:"Грузовики",h:"/category/trucks"},{l:"Спецтехника",h:"/category/special"},{l:"Вода",h:"/category/water"},{l:"Авиа",h:"/category/air"}].map((c) => (
                <Link key={c.h} href={c.h} style={{textDecoration:"none"}}>
                  <Badge size="md" radius="md" style={{cursor:"pointer",background:"rgba(255,255,255,0.95)",color:"#4f46e5",fontWeight:600}}>{c.l}</Badge>
                </Link>))}
            </Group>
            <Group gap="xs" wrap="wrap">
              <Text size="xs" c="rgba(255,255,255,0.7)" fw={600} tt="uppercase">Запчасти:</Text>
              {[{l:"Все запчасти",h:"/parts-finder"},{l:"Двигатель",h:"/parts-finder?partType=ENGINE"},{l:"Тормоза",h:"/parts-finder?partType=BRAKES"},{l:"Подвеска",h:"/parts-finder?partType=SUSPENSION"},{l:"Оптика",h:"/parts-finder?partType=LIGHTING"},{l:"Электрика",h:"/parts-finder?partType=ELECTRICAL"}].map((c) => (
                <Link key={c.h} href={c.h} style={{textDecoration:"none"}}>
                  <Badge size="md" radius="md" style={{cursor:"pointer",background:"rgba(255,255,255,0.2)",color:"white",fontWeight:500,border:"1px solid rgba(255,255,255,0.3)"}}>{c.l}</Badge>
                </Link>))}
            </Group>
          </Box>
        </Paper>)}

      <Group justify="space-between" align="center">
        <Stack gap={0}>
          <Text component="h1" fw={800} fz={{base:20,md:24}} c="dark.9">{p.pageTitle || "Все объявления"}</Text>
          {data && <Text size="xs" c="gray.5">{data.pagination?.total || 0} объявлений</Text>}
        </Stack>
        <SegmentedControl size="md" value={view} onChange={(v) => setView(v)} radius="md" data={[{label:<Group gap={4}><IconLayoutGrid size={16} stroke={1.8}/> <Text size="xs" fw={600}>Сетка</Text></Group>,value:"grid"},{label:<Group gap={4}><IconList size={16} stroke={1.8}/> <Text size="xs" fw={600}>Список</Text></Group>,value:"list"}]} />
      </Group>

      <Paper radius="md" p="md" withBorder style={{background:"var(--mantine-color-body)"}}>
        <Stack gap="sm">
          <Group gap="xs" wrap="wrap" align="flex-end">
            <TextInput placeholder="Поиск по тексту..." leftSection={<IconSearch size={14}/>} value={query} onChange={(e) => setQuery(e.target.value)} size="sm" style={{flex:1,minWidth:200}} />
            <Select placeholder="Марка" data={brandOptions} searchable clearable value={make} onChange={(v) => {setMake(v);setModel(null)}} size="sm" w={150} />
            <Select placeholder="Модель" data={modelOptions} searchable clearable disabled={!make} value={model} onChange={setModel} size="sm" w={140} />
            <Select data={SORT_OPTIONS.map((o) => ({value:o.value,label:o.label}))} value={sort} onChange={(v) => setSort(v || "newest")} size="sm" w={160} />
          </Group>

          <Group gap="xs" wrap="wrap" align="flex-end">
            <TextInput placeholder="Цена от, ₽" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} size="sm" w={110} type="number" />
            <TextInput placeholder="Цена до, ₽" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} size="sm" w={110} type="number" />
            <Select placeholder="Год от" data={yearData} searchable clearable value={yearFrom} onChange={setYearFrom} size="sm" w={100} />
            <Select placeholder="Год до" data={yearData} searchable clearable value={yearTo} onChange={setYearTo} size="sm" w={100} />
            <Select placeholder="Город" data={POPULAR_CITIES.map((c) => ({value:c,label:c}))} searchable clearable value={city} onChange={setCity} size="sm" w={150} />
            <TextInput placeholder="Пробег до, км" value={mileageTo} onChange={(e) => setMileageTo(e.target.value)} size="sm" w={130} type="number" />
          </Group>

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
                    <Chip key={t.value} checked={transmission === t.value} onChange={() => setTransmission(transmission === t.value ? null : t.value)} variant={transmission === t.value ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{t.label}</Chip>
                  ))}</Group>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Привод</Text>
                  <Group gap={6}>{DRIVE_TYPES.map((d) => (
                    <Chip key={d.value} checked={driveType === d.value} onChange={() => setDriveType(driveType === d.value ? null : d.value)} variant={driveType === d.value ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{d.label}</Chip>
                  ))}</Group>
                </Box>
              </Group>
              )}

              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconGasStation size={14}/> Тип топлива</Text>
                <Group gap={6}>{FUEL_TYPES.map((f) => (
                  <Chip key={f.value} checked={fuelType.includes(f.value)} onChange={(c) => { setFuelType(c ? [...fuelType, f.value] : fuelType.filter((v) => v !== f.value)); setPage(1) }} variant={fuelType.includes(f.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{f.label}</Chip>
                ))}</Group>
              </Box>

              {/* Подтип по категории */}
              {vt === "CAR" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconCar size={14}/> Тип кузова</Text>
                <Group gap={6}>{BODY_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "MOTORCYCLE" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconCar size={14}/> Тип мотоцикла</Text>
                <Group gap={6}>{MOTORCYCLE_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "TRUCK" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconTruck size={14}/> Тип кузова / надстройки</Text>
                <Group gap={6}>{TRUCK_BODY_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "SPECIAL" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconTractor size={14}/> Тип спецтехники</Text>
                <Group gap={6}>{SPECIAL_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "WATER" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconSpeedboat size={14}/> Тип судна</Text>
                <Group gap={6}>{WATER_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "AIR" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconPlane size={14}/> Тип воздушного судна</Text>
                <Group gap={6}>{AIR_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{b.label}</Chip>
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
                    <Chip key={c.value} checked={condition.includes(c.value)} onChange={(ch) => { setCondition(ch ? [...condition, c.value] : condition.filter((v) => v !== c.value)); setPage(1) }} variant={condition.includes(c.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{c.label}</Chip>
                  ))}</Group>
                </Box>
              </Group>

              {(vt === "CAR" || vt === "TRUCK") && (
              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Руль</Text>
                  <Group gap={6}>{STEERING_WHEELS.map((sw) => (
                    <Chip key={sw.value} checked={steeringWheel === sw.value} onChange={() => setSteeringWheel(steeringWheel === sw.value ? null : sw.value)} variant={steeringWheel === sw.value ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{sw.label}</Chip>
                  ))}</Group>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Продавец</Text>
                  <Group gap={6}>{SELLER_TYPES.map((st) => (
                    <Chip key={st.value} checked={sellerType === st.value} onChange={() => setSellerType(sellerType === st.value ? null : st.value)} variant={sellerType === st.value ? "filled" : "outline"} color="indigo" size="md" radius="xl" styles={{ root: { transition: "all 150ms ease", cursor: "pointer" }, label: { fontWeight: 600, padding: "4px 14px" } }}>{st.label}</Chip>
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
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Страна марки</Text>
                  <Select placeholder="Неважно" data={COUNTRIES_OF_ORIGIN.map((c) => ({value:c.value,label:c.label}))} clearable value={countryOfOrigin} onChange={setCountryOfOrigin} size="sm" w={160}/>
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
