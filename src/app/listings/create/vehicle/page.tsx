"use client"
export const dynamic = "force-dynamic"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Box, Stack, Text, Paper, TextInput, Textarea, Select, NumberInput, Button, Group, Divider, Container, Loader, Center, SegmentedControl, ThemeIcon, FileInput, ActionIcon, SimpleGrid, Badge, Chip } from "@mantine/core"
import { IconCar, IconCheck, IconPlus, IconPhoto, IconX } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import { getBrandsByCategory, getModels } from "@/lib/catalog"
import { BODY_TYPES, DRIVE_TYPES, CONDITIONS, STEERING_WHEELS, DOCUMENT_STATUSES, DAMAGE_INFO, SELLER_TYPES, AVAILABILITY_TYPES, MOTORCYCLE_TYPES, TRUCK_BODY_TYPES, TRUCK_AXLE_FORMULAS, SPECIAL_TYPES, WATER_TYPES, HULL_MATERIALS, AIR_TYPES, ENGINE_TYPE_AIR, getFuelOptions, getTransmissionOptions, getUsageMeta, getVehicleIdentityMeta, supportsTransmission } from "@/lib/constants"
import type { MarketplaceVehicleType } from "@/lib/vehicleCategories"
import { useMarketplaceImageUpload } from "@/hooks/useMarketplaceImageUpload"

const CATS = [
  { value: "CAR", label: "Легковые" },
  { value: "MOTORCYCLE", label: "Мото" },
  { value: "TRUCK", label: "Грузовики" },
  { value: "SPECIAL", label: "Спецтехника" },
  { value: "WATER", label: "Водный транспорт" },
  { value: "AIR", label: "Авиа" },
]

const BRAND_CATEGORY_BY_VEHICLE_TYPE = {
  CAR: "cars",
  MOTORCYCLE: "moto",
  TRUCK: "trucks",
  SPECIAL: "special",
  WATER: "water",
  AIR: "air",
} as const

export default function CreateVehiclePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { images, uploadingImages, uploadPhotos, removeImage } = useMarketplaceImageUpload()
  const [categories, setCategories] = useState<Array<{ id: string; name: string; vehicleType: MarketplaceVehicleType | null }>>([])

  const [f, setF] = useState({
    title: "", make: "", model: "", year: "", price: "", mileage: "",
    operatingHours: "", flightHours: "",
    vin: "", serialNumber: "", registrationNumber: "", fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SEDAN",
    color: "", doors: "", engineVolume: "", power: "", driveType: "FWD",
    condition: "EXCELLENT", location: "", description: "",
    vehicleType: "CAR",
    steeringWheel: "LEFT", ownersCount: "", documentsStatus: "CLEAN",
    damageInfo: "NONE", sellerType: "OWNER", availability: "IN_STOCK",
    customsCleared: "true", generation: "", keywords: "",
    motorcycleType: "", finalDrive: "", strokeCycle: "", truckBodyType: "", axleFormula: "", ecoClass: "", payloadKg: "", grossWeightKg: "", transmissionVariant: "",
    specialType: "", operatingWeightKg: "", bucketVolumeM3: "", diggingDepthM: "", waterType: "", hullMaterial: "", hullLengthM: "", waterEngineType: "",
    airType: "", airEngineType: "", engineCount: "", mtowKg: "", passengerCapacity: "",
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin")
  }, [status, router])

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(d => {
      if (Array.isArray(d.categories)) setCategories(d.categories)
    }).catch(() => {})
  }, [])

  if (status === "loading") return <Center py={100}><Loader color="indigo" /></Center>
  if (!session) return null

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const setVehicleType = (vehicleType: string) => setF((previous) => ({
    ...previous,
    vehicleType,
    make: "",
    model: "",
    vin: "",
    serialNumber: "",
    registrationNumber: "",
    fuelType: getFuelOptions(vehicleType)[0]?.value || "OTHER",
    transmission: getTransmissionOptions(vehicleType)[0]?.value || "",
    bodyType: vehicleType === "CAR" ? previous.bodyType || "SEDAN" : "",
    driveType: vehicleType === "CAR" ? previous.driveType || "FWD" : "",
  }))
  const usageMeta = getUsageMeta(f.vehicleType)
  const identityMeta = getVehicleIdentityMeta(f.vehicleType)
  const fuelOptions = getFuelOptions(f.vehicleType)
  const transmissionOptions = getTransmissionOptions(f.vehicleType)
  const selectedCategory = categories.find((category) => category.vehicleType === f.vehicleType)
  const brandCategory = BRAND_CATEGORY_BY_VEHICLE_TYPE[f.vehicleType as keyof typeof BRAND_CATEGORY_BY_VEHICLE_TYPE] || "cars"
  const brandOptions = getBrandsByCategory(brandCategory)
  const modelOptions = f.make.trim() ? getModels(f.make.trim(), brandCategory) : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.make || !f.model || !f.year || !f.price || !f.location.trim()) {
      notifications.show({ title: "Ошибка", message: "Заполните обязательные поля", color: "red" })
      return
    }
    if (images.length === 0) {
      notifications.show({ title: "Добавьте фото", message: "Для публикации транспорта нужна хотя бы одна фотография.", color: "orange" })
      return
    }
    if (!selectedCategory) {
      notifications.show({ title: "Категория недоступна", message: "Не удалось подобрать категорию для выбранного типа транспорта. Обновите страницу.", color: "red" })
      return
    }
    setLoading(true)
    try {
      // Сервер создаёт ТС и объявление в одной транзакции: не оставляем
      // транспорт без объявления, если сеть оборвётся между запросами.
      const vehRes = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title || `${f.year} ${f.make} ${f.model}`,
          make: f.make, model: f.model, year: Number(f.year), price: Number(f.price),
          mileage: f.mileage ? Number(f.mileage) : null,
          operatingHours: f.operatingHours ? Number(f.operatingHours) : null,
          flightHours: f.flightHours ? Number(f.flightHours) : null,
          vin: f.vin || null,
          serialNumber: f.serialNumber || null,
          registrationNumber: f.registrationNumber || null,
          fuelType: f.fuelType, transmission: f.transmission, bodyType: f.bodyType,
          color: f.color || null, doors: f.doors ? Number(f.doors) : null,
          engineVolume: f.engineVolume ? parseFloat(f.engineVolume) : null,
          power: f.power ? Number(f.power) : null, driveType: f.driveType,
          condition: f.condition, location: f.location,
          description: f.description, images: images.length > 0 ? JSON.stringify(images) : null,
          steeringWheel: f.steeringWheel, ownersCount: f.ownersCount || null,
          documentsStatus: f.documentsStatus, damageInfo: f.damageInfo,
          sellerType: f.sellerType, availability: f.availability,
          customsCleared: f.customsCleared === "true",
          generation: f.generation, keywords: f.keywords,
          vehicleType: f.vehicleType,
          typeDetails: {
            motorcycleType: f.motorcycleType,
            finalDrive: f.finalDrive,
            strokeCycle: f.strokeCycle,
            truckBodyType: f.truckBodyType,
            axleFormula: f.axleFormula,
            ecoClass: f.ecoClass,
            payloadKg: f.payloadKg ? Number(f.payloadKg) : "",
            grossWeightKg: f.grossWeightKg ? Number(f.grossWeightKg) : "",
            transmissionVariant: f.transmissionVariant,
            specialType: f.specialType,
            operatingWeightKg: f.operatingWeightKg ? Number(f.operatingWeightKg) : "",
            bucketVolumeM3: f.bucketVolumeM3 ? Number(f.bucketVolumeM3) : "",
            diggingDepthM: f.diggingDepthM ? Number(f.diggingDepthM) : "",
            waterType: f.waterType,
            hullMaterial: f.hullMaterial,
            hullLengthM: f.hullLengthM ? Number(f.hullLengthM) : "",
            waterEngineType: f.waterEngineType,
            airType: f.airType,
            airEngineType: f.airEngineType,
            engineCount: f.engineCount ? Number(f.engineCount) : "",
            mtowKg: f.mtowKg ? Number(f.mtowKg) : "",
            passengerCapacity: f.passengerCapacity ? Number(f.passengerCapacity) : "",
          },
          categoryId: selectedCategory.id,
        }),
      })
      const veh = await vehRes.json()
      if (!vehRes.ok) throw new Error(veh.error || "Ошибка создания ТС")

      notifications.show({ title: "Отправлено на проверку", message: "Мы проверим объявление и опубликуем его после модерации.", color: "indigo" })
      router.push(`/listings/vehicle/${veh.id}`)
    } catch (err) {
      notifications.show({ title: "Ошибка", message: err instanceof Error ? err.message : "Не удалось создать объявление", color: "red" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="create-listing-page" size="md" py="lg">
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconPlus size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Новое объявление</Text>
            <Text size="xs" c="gray.5">Заполните данные — после проверки объявление появится в поиске</Text>
          </Stack>
        </Group>

        <Paper className="create-listing__journey" radius="lg" p="sm" withBorder>
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing={0}>
            {[
              { number: "01", label: "Категория", description: CATS.find((category) => category.value === f.vehicleType)?.label || "Транспорт" },
              { number: "02", label: "Данные объявления", description: "Марка, цена и характеристики" },
              { number: "03", label: "Фото и публикация", description: images.length ? `Добавлено фото: ${images.length}` : "Добавьте реальные фотографии" },
            ].map((step, index) => (
              <Group className="create-listing__journey-step" data-current={index === 0 || undefined} gap="sm" key={step.number} wrap="nowrap">
                <Text className="create-listing__journey-number">{step.number}</Text>
                <Stack gap={1}>
                  <Text size="xs" fw={800} c="dark.8">{step.label}</Text>
                  <Text size="11px" c="dimmed">{step.description}</Text>
                </Stack>
              </Group>
            ))}
          </SimpleGrid>
        </Paper>

        <form onSubmit={handleSubmit}>
          <Stack className="create-listing__form" gap="md">
            {/* Тип транспорта */}
            <Paper className="create-listing__section" data-accent="indigo" radius="lg" p="md" withBorder>
              <Group justify="space-between" mb="sm">
                <Text fw={700} fz="sm" c="dark.9">Тип транспорта</Text>
                <Badge size="sm" color="indigo" variant="light">Шаг 1</Badge>
              </Group>
              <SegmentedControl value={f.vehicleType} onChange={setVehicleType} data={CATS} size="sm" radius="md" fullWidth />
            </Paper>

            {/* Основное */}
            <Paper className="create-listing__section" radius="lg" p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={1}>
                    <Text fw={700} fz="sm" c="dark.9">Основная информация</Text>
                    <Text size="xs" c="dimmed">Данные, по которым покупатель найдёт транспорт.</Text>
                  </Stack>
                  <Badge size="sm" color="gray" variant="light">Шаг 2</Badge>
                </Group>
                <TextInput label="Заголовок" placeholder="2018 Toyota Camry" required value={f.title} onChange={(e) => set("title", e.target.value)} size="sm" />
                <Group gap="sm" grow>
                  <TextInput
                    label="Марка"
                    placeholder="Toyota"
                    description="Начните вводить или выберите из каталога"
                    required
                    value={f.make}
                    onChange={(e) => setF((previous) => ({ ...previous, make: e.currentTarget.value, model: "" }))}
                    size="sm"
                    list="vehicle-brands"
                  />
                  <TextInput
                    label="Модель"
                    placeholder={f.make ? "Выберите или введите модель" : "Сначала укажите марку"}
                    description={f.make && modelOptions.length === 0 ? "Модель можно указать вручную" : undefined}
                    required
                    disabled={!f.make.trim()}
                    value={f.model}
                    onChange={(e) => set("model", e.currentTarget.value)}
                    size="sm"
                    list="vehicle-models"
                  />
                </Group>
                <datalist id="vehicle-brands">
                  {brandOptions.map((brand) => <option key={brand.name} value={brand.name} />)}
                </datalist>
                <datalist id="vehicle-models">
                  {modelOptions.map((model) => <option key={model} value={model} />)}
                </datalist>
                <Group gap="sm" grow>
                  <NumberInput label="Год" placeholder="2018" required value={f.year ? Number(f.year) : undefined} onChange={(v) => set("year", String(v || ""))} size="sm" min={1886} max={new Date().getFullYear() + 1} />
                  <NumberInput label="Цена, ₽" placeholder="1500000" required value={f.price ? Number(f.price) : undefined} onChange={(v) => set("price", String(v || ""))} size="sm" min={0} />
                  <NumberInput label={`${usageMeta.label}, ${usageMeta.unit}`} placeholder={usageMeta.field === "mileage" ? "120 000" : "2 500"} value={usageMeta.field === "flightHours" ? (f.flightHours ? Number(f.flightHours) : undefined) : usageMeta.field === "operatingHours" ? (f.operatingHours ? Number(f.operatingHours) : undefined) : (f.mileage ? Number(f.mileage) : undefined)} onChange={(v) => set(usageMeta.field, String(v || ""))} size="sm" min={0} />
                </Group>
                <Group gap="sm" grow>
                  <TextInput label="Город" placeholder="Москва" required value={f.location} onChange={(e) => set("location", e.target.value)} size="sm" />
                  <TextInput label={identityMeta.label} placeholder={identityMeta.placeholder} value={identityMeta.field === "vin" ? f.vin : identityMeta.field === "serialNumber" ? f.serialNumber : f.registrationNumber} onChange={(e) => set(identityMeta.field, e.target.value.toUpperCase())} size="sm" maxLength={identityMeta.maxLength} required description={identityMeta.description} />
                </Group>
              </Stack>
            </Paper>

            {/* Характеристики */}
            <Paper className="create-listing__section" radius="lg" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="dark.9">Характеристики</Text>
                <Group gap="sm" grow>
                  <Select label={f.vehicleType === "AIR" ? "Тип топлива" : "Топливо"} data={fuelOptions.map(t => ({ value: t.value, label: t.label }))} value={f.fuelType} onChange={(v) => set("fuelType", v || "")} size="sm" />
                  {supportsTransmission(f.vehicleType) && <Select label="КПП" data={transmissionOptions.map(t => ({ value: t.value, label: t.label }))} value={f.transmission} onChange={(v) => set("transmission", v || "")} size="sm" />}
                  {f.vehicleType === "CAR" && <Select label="Привод" data={DRIVE_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.driveType} onChange={(v) => set("driveType", v || "")} size="sm" />}
                </Group>
                {f.vehicleType === "CAR" && (
                  <Select label="Тип кузова" data={BODY_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.bodyType} onChange={(v) => set("bodyType", v || "")} size="sm" />
                )}
                {f.vehicleType === "MOTORCYCLE" && (
                  <Group gap="sm" grow>
                    <Select label="Тип мотоцикла" data={MOTORCYCLE_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.motorcycleType} onChange={(v) => set("motorcycleType", v || "")} size="sm" />
                    <Select label="Главная передача" data={[{ value: "CHAIN", label: "Цепь" }, { value: "SHAFT", label: "Кардан" }, { value: "BELT", label: "Ремень" }]} value={f.finalDrive} onChange={(v) => set("finalDrive", v || "")} size="sm" />
                    <Select label="Тактность" data={[{ value: "2T", label: "2T" }, { value: "4T", label: "4T" }]} value={f.strokeCycle} onChange={(v) => set("strokeCycle", v || "")} size="sm" />
                  </Group>
                )}
                {f.vehicleType === "TRUCK" && (
                  <Stack gap="sm">
                    <Group gap="sm" grow>
                      <Select label="Тип кузова / прицепа" data={TRUCK_BODY_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.truckBodyType} onChange={(v) => set("truckBodyType", v || "")} size="sm" />
                      <Select label="Колёсная формула" data={TRUCK_AXLE_FORMULAS.map(t => ({ value: t.value, label: t.label }))} value={f.axleFormula} onChange={(v) => set("axleFormula", v || "")} size="sm" />
                      <Select label="Экологический класс" data={["Евро-3", "Евро-4", "Евро-5", "Евро-6"].map(value => ({ value, label: value }))} value={f.ecoClass} onChange={(v) => set("ecoClass", v || "")} size="sm" />
                    </Group>
                    <Group gap="sm" grow>
                      <NumberInput label="Грузоподъёмность, кг" value={f.payloadKg ? Number(f.payloadKg) : undefined} onChange={(v) => set("payloadKg", String(v || ""))} size="sm" min={0} />
                      <NumberInput label="Полная масса, кг" value={f.grossWeightKg ? Number(f.grossWeightKg) : undefined} onChange={(v) => set("grossWeightKg", String(v || ""))} size="sm" min={0} />
                      <TextInput label="Серия КПП" placeholder="I-Shift, Optidriver" value={f.transmissionVariant} onChange={(e) => set("transmissionVariant", e.target.value)} size="sm" />
                    </Group>
                  </Stack>
                )}
                {f.vehicleType === "SPECIAL" && (
                  <Stack gap="sm">
                    <Select label="Вид спецтехники" data={SPECIAL_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.specialType} onChange={(v) => set("specialType", v || "")} size="sm" />
                    <Group gap="sm" grow>
                      <NumberInput label="Эксплуатационная масса, кг" value={f.operatingWeightKg ? Number(f.operatingWeightKg) : undefined} onChange={(v) => set("operatingWeightKg", String(v || ""))} size="sm" min={0} />
                      <NumberInput label="Объём ковша, м³" value={f.bucketVolumeM3 ? Number(f.bucketVolumeM3) : undefined} onChange={(v) => set("bucketVolumeM3", String(v || ""))} size="sm" min={0} decimalScale={2} />
                      <NumberInput label="Глубина копания, м" value={f.diggingDepthM ? Number(f.diggingDepthM) : undefined} onChange={(v) => set("diggingDepthM", String(v || ""))} size="sm" min={0} decimalScale={2} />
                    </Group>
                  </Stack>
                )}
                {f.vehicleType === "WATER" && (
                  <Stack gap="sm">
                    <Group gap="sm" grow>
                      <Select label="Тип водного транспорта" data={WATER_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.waterType} onChange={(v) => set("waterType", v || "")} size="sm" />
                      <Select label="Материал корпуса" data={HULL_MATERIALS.map(t => ({ value: t.value, label: t.label }))} value={f.hullMaterial} onChange={(v) => set("hullMaterial", v || "")} size="sm" />
                      <Select label="Тип мотора" data={[{ value: "OUTBOARD", label: "Подвесной" }, { value: "INBOARD", label: "Стационарный" }, { value: "JET", label: "Водомёт" }]} value={f.waterEngineType} onChange={(v) => set("waterEngineType", v || "")} size="sm" />
                    </Group>
                    <NumberInput label="Длина корпуса, м" value={f.hullLengthM ? Number(f.hullLengthM) : undefined} onChange={(v) => set("hullLengthM", String(v || ""))} size="sm" min={0} decimalScale={2} />
                  </Stack>
                )}
                {f.vehicleType === "AIR" && (
                  <Stack gap="sm">
                    <Group gap="sm" grow>
                      <Select label="Категория ВС" data={AIR_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.airType} onChange={(v) => set("airType", v || "")} size="sm" />
                      <Select label="Тип двигателя" data={ENGINE_TYPE_AIR.map(t => ({ value: t.value, label: t.label }))} value={f.airEngineType} onChange={(v) => set("airEngineType", v || "")} size="sm" />
                    </Group>
                    <Group gap="sm" grow>
                      <NumberInput label="Количество двигателей" value={f.engineCount ? Number(f.engineCount) : undefined} onChange={(v) => set("engineCount", String(v || ""))} size="sm" min={0} />
                      <NumberInput label="МВМ, кг" value={f.mtowKg ? Number(f.mtowKg) : undefined} onChange={(v) => set("mtowKg", String(v || ""))} size="sm" min={0} />
                      <NumberInput label="Пассажировместимость" value={f.passengerCapacity ? Number(f.passengerCapacity) : undefined} onChange={(v) => set("passengerCapacity", String(v || ""))} size="sm" min={0} />
                    </Group>
                  </Stack>
                )}
                <Group gap="sm" grow>
                  <TextInput label="Объём двигателя, л" placeholder="2.0" value={f.engineVolume} onChange={(e) => set("engineVolume", e.target.value)} size="sm" type="number" step="0.1" />
                  <TextInput label="Мощность, л.с." placeholder="150" value={f.power} onChange={(e) => set("power", e.target.value)} size="sm" type="number" />
                  <TextInput label="Цвет" placeholder="Белый" value={f.color} onChange={(e) => set("color", e.target.value)} size="sm" />
                </Group>
                <Stack gap={6}>
                  <Text size="xs" fw={700} c="dimmed">Состояние</Text>
                  <Group gap={6}>
                    {CONDITIONS.map((item) => (
                      <Chip
                        key={item.value}
                        checked={f.condition === item.value}
                        onChange={() => set("condition", item.value)}
                        variant={f.condition === item.value ? "filled" : "outline"}
                        color="indigo"
                        size="sm"
                        radius="xl"
                      >
                        {item.label}
                      </Chip>
                    ))}
                  </Group>
                </Stack>
                <Select label="Руль" data={STEERING_WHEELS.map(t => ({ value: t.value, label: t.label }))} value={f.steeringWheel} onChange={(v) => set("steeringWheel", v || "")} size="sm" />
              </Stack>
            </Paper>

            {/* Документы и состояние */}
            <Paper className="create-listing__section" radius="lg" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="dark.9">Документы и состояние</Text>
                <Group gap="sm" grow>
                  <Select label="Документы" data={DOCUMENT_STATUSES.map(t => ({ value: t.value, label: t.label }))} value={f.documentsStatus} onChange={(v) => set("documentsStatus", v || "")} size="sm" />
                  <Select label="Повреждения" data={DAMAGE_INFO.map(t => ({ value: t.value, label: t.label }))} value={f.damageInfo} onChange={(v) => set("damageInfo", v || "")} size="sm" />
                </Group>
                <Group gap="sm" grow>
                  <NumberInput label="Владельцев" placeholder="2" value={f.ownersCount ? Number(f.ownersCount) : undefined} onChange={(v) => set("ownersCount", String(v || ""))} size="sm" min={1} max={10} />
                  <Select label="Продавец" data={SELLER_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.sellerType} onChange={(v) => set("sellerType", v || "")} size="sm" />
                  <TextInput label="Поколение" placeholder="VII (XV50)" value={f.generation} onChange={(e) => set("generation", e.target.value)} size="sm" />
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <Stack gap={6}>
                    <Text size="xs" fw={700} c="dimmed">Наличие</Text>
                    <SegmentedControl
                      value={f.availability}
                      onChange={(value) => set("availability", value)}
                      data={AVAILABILITY_TYPES.map((item) => ({ value: item.value, label: item.label }))}
                      size="sm"
                      radius="md"
                      fullWidth
                    />
                  </Stack>
                  <Stack gap={6}>
                    <Text size="xs" fw={700} c="dimmed">Растаможен</Text>
                    <SegmentedControl
                      value={f.customsCleared}
                      onChange={(value) => set("customsCleared", value)}
                      data={[{ value: "true", label: "Да" }, { value: "false", label: "Нет" }]}
                      size="sm"
                      radius="md"
                      fullWidth
                    />
                  </Stack>
                </SimpleGrid>
              </Stack>
            </Paper>

            {/* Описание */}
            <Paper className="create-listing__section" radius="lg" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="dark.9">Описание</Text>
                <Textarea label="Подробное описание" placeholder="Опишите состояние, историю, комплектацию..." value={f.description} onChange={(e) => set("description", e.target.value)} size="sm" minRows={4} autosize />
                <TextInput label="Ключевые слова" placeholder='"один хозяин", ксенон, панорама...' value={f.keywords} onChange={(e) => set("keywords", e.target.value)} size="sm" />
                <Text size="xs" c="gray.5">Ключевые слова помогают найти ваше объявление</Text>
              </Stack>
            </Paper>

            <Paper className="create-listing__section" data-accent="indigo" radius="lg" p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Group gap="sm">
                    <ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconPhoto size={18} /></ThemeIcon>
                    <Stack gap={0}>
                      <Text fw={700} fz="sm" c="dark.9">Фотографии транспорта</Text>
                      <Text size="xs" c="gray.5">Первая фотография станет обложкой. До 12 JPG, PNG или WebP — до 10 МБ каждая.</Text>
                    </Stack>
                  </Group>
                  <Badge variant="light" color={images.length ? "indigo" : "gray"}>{images.length}/12</Badge>
                </Group>
                <FileInput
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  clearable
                  disabled={uploadingImages || images.length >= 12}
                  placeholder="Выберите фотографии"
                  onChange={uploadPhotos}
                  leftSection={<IconPhoto size={16} />}
                />
                {uploadingImages && <Text size="xs" c="indigo">Загружаем фотографии…</Text>}
                {images.length > 0 && (
                  <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing="xs">
                    {images.map((image, index) => (
                      <Box key={image} pos="relative" style={{ aspectRatio: "1", overflow: "hidden", borderRadius: 10, border: index === 0 ? "2px solid var(--mantine-color-indigo-5)" : "1px solid var(--mantine-color-gray-3)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt={`Фото ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <ActionIcon aria-label={`Удалить фото ${index + 1}`} type="button" size="sm" color="dark" variant="filled" pos="absolute" top={5} right={5} onClick={() => removeImage(index)}><IconX size={13} /></ActionIcon>
                        {index === 0 && <Badge size="xs" color="indigo" variant="filled" pos="absolute" left={5} bottom={5}>Обложка</Badge>}
                      </Box>
                    ))}
                  </SimpleGrid>
                )}
              </Stack>
            </Paper>

            {/* Кнопка */}
            <Paper className="create-listing__submit" radius="lg" p="sm" withBorder>
              <Stack gap={6}>
                <Button fullWidth type="submit" size="md" radius="md" color="indigo" loading={loading} disabled={!selectedCategory || uploadingImages} leftSection={<IconCheck size={18} />}>
                  {loading ? "Публикация..." : "Отправить на модерацию"}
                </Button>
                <Text size="xs" c="dimmed" ta="center">Сначала объявление проверит модератор. Статус появится в личном кабинете.</Text>
              </Stack>
            </Paper>
          </Stack>
        </form>
      </Stack>
    </Container>
  )
}
