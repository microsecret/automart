"use client"
export const dynamic = "force-dynamic"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Alert, Autocomplete, Stack, Text, Paper, TextInput, Textarea, Select, NumberInput, Button, Group, Container, Loader, Center, SegmentedControl, ThemeIcon, FileInput, SimpleGrid, Badge, Chip } from "@mantine/core"
import { IconBrandTelegram, IconCar, IconCheck, IconPlus, IconPhoto } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import { getBrandsByCategory, getModels } from "@/lib/catalog"
import { useTelegramClosingGuard } from "@/lib/use-telegram-closing-guard"
import { BODY_TYPES, DRIVE_TYPES, CONDITIONS, STEERING_WHEELS, DOCUMENT_STATUSES, DAMAGE_INFO, SELLER_TYPES, AVAILABILITY_TYPES, MOTORCYCLE_TYPES, TRUCK_BODY_TYPES, TRUCK_AXLE_FORMULAS, SPECIAL_TYPES, WATER_TYPES, HULL_MATERIALS, AIR_TYPES, ENGINE_TYPE_AIR, getSelectableFuelOptions, getSelectableTransmissionOptions, getUsageMeta, getVehicleIdentityMeta, supportsTransmission } from "@/lib/constants"
import { describeRequiredSpecs } from "@/lib/listing-required-specs"
import { getMissingVehiclePublicationRequirements, getVehiclePublicationRequirements, type VehiclePublicationField } from "@/lib/vehicle-publication-readiness"
import type { MarketplaceVehicleType } from "@/lib/vehicleCategories"
import { useMarketplaceImageUpload } from "@/hooks/useMarketplaceImageUpload"
import ListingPhotoGrid from "@/components/uploads/ListingPhotoGrid"
import { fetchJson } from "@/lib/api-client"
import { parseImages } from "@/lib/format"
import BrandIcon from "@/components/brands/BrandIcon"
import styles from "../listing-create-form.module.css"

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

type VehicleCategory = {
  id: string
  name: string
  vehicleType: MarketplaceVehicleType | null
}

type CategoriesResponse = { categories: VehicleCategory[] }
type CreateVehicleResponse = { id: string; listings: Array<{ id: string; status: string }> }
type GarageVehicleResponse = {
  vehicle: {
    id: string
    make: string
    model: string
    year: number
    mileage: number | null
    vin: string | null
    fuelType: string
    transmission: string
    bodyType: string | null
    color: string | null
    condition: string | null
    location: string
    doors: number | null
    engineVolume: number | null
    power: number | null
    driveType: string | null
    steeringWheel: string | null
    ownersCount: number | null
    documentsStatus: string | null
    damageInfo: string | null
    sellerType: string | null
    availability: string | null
    customsCleared: boolean | null
    generation: string | null
    keywords: string | null
    description: string | null
    images: string | null
  }
}

const DRAFT_STORAGE_KEY = "vehicle-listing-draft-v1"

export default function CreateVehiclePage() {
  return (
    <Suspense fallback={<Center py={100}><Loader color="indigo" /></Center>}>
      <CreateVehicleWorkspace />
    </Suspense>
  )
}

function CreateVehicleWorkspace() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isTelegramMiniApp = searchParams.get("source") === "telegram"
  const isGarageMode = searchParams.get("mode") === "garage"
  const garageId = searchParams.get("garageId")?.trim() || ""
  const isGarageEdit = isGarageMode && Boolean(garageId)
  const garagePrefillAttempted = useRef(false)
  const [garagePrefillState, setGaragePrefillState] = useState<"loading" | "loaded" | "error" | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const { images, uploadingImages, uploadPhotos, removeImage, replaceImages } = useMarketplaceImageUpload()
  const [categories, setCategories] = useState<VehicleCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  const [f, setF] = useState({
    title: "", make: "", model: "", year: "", price: "", mileage: "",
    operatingHours: "", flightHours: "",
    vin: "", serialNumber: "", registrationNumber: "", fuelType: isGarageMode ? "GASOLINE" : "", transmission: isGarageMode ? "AUTOMATIC" : "", bodyType: isGarageMode ? "SEDAN" : "",
    color: "", doors: "", engineVolume: "", power: "", driveType: isGarageMode ? "FWD" : "",
    condition: isGarageMode ? "EXCELLENT" : "", location: "", description: "",
    vehicleType: "CAR",
    steeringWheel: isGarageMode ? "LEFT" : "", ownersCount: "", documentsStatus: isGarageMode ? "CLEAN" : "",
    damageInfo: isGarageMode ? "NONE" : "", sellerType: isGarageMode ? "OWNER" : "", availability: isGarageMode ? "IN_STOCK" : "",
    customsCleared: isGarageMode ? "true" : "", generation: "", keywords: "",
    motorcycleType: "", finalDrive: "", strokeCycle: "", truckBodyType: "", axleFormula: "", ecoClass: "", payloadKg: "", grossWeightKg: "", transmissionVariant: "",
    specialType: "", operatingWeightKg: "", bucketVolumeM3: "", diggingDepthM: "", waterType: "", hullMaterial: "", hullLengthM: "", waterEngineType: "",
    airType: "", airEngineType: "", engineCount: "", mtowKg: "", passengerCapacity: "",
  })

  useEffect(() => {
    /* callbackUrl возвращает в форму после входа: раньше истёкшая сессия
       выкидывала на вход без возврата, и заполненное пропадало. */
    if (status === "unauthenticated") router.push("/auth/signin?callbackUrl=%2Flistings%2Fcreate%2Fvehicle")
  }, [status, router])

  /* === Черновик в браузере ===

     Форма держит около сорока полей, и всё это жило только в памяти
     вкладки: случайный «назад», обрыв сети или истёкшая сессия стирали
     работу за пятнадцать минут — главная точка потери продавцов. Фото
     здесь — уже загруженные адреса, поэтому восстанавливается и оно.

     Гаражный режим не сохраняется: там форму наполняет сама машина из
     гаража, и черновик перезаписал бы её данные. */
  const draftRestoredRef = useRef(false)

  useEffect(() => {
    if (isGarageMode || draftRestoredRef.current) return
    draftRestoredRef.current = true
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as { f?: typeof f; images?: string[]; savedAt?: number }
      if (!draft?.f) return
      /* Черновик старше недели скорее мусор, чем работа. */
      if (!draft.savedAt || Date.now() - draft.savedAt > 7 * 86_400_000) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY)
        return
      }
      const hasContent = Boolean(draft.f.make || draft.f.model || draft.f.title || draft.f.description || draft.images?.length)
      if (!hasContent) return
      setF((current) => ({ ...current, ...draft.f }))
      if (draft.images?.length) replaceImages(draft.images)
      notifications.show({
        title: "Черновик восстановлен",
        message: "Мы сохранили заполненное с прошлого раза. Продолжайте с того же места.",
        color: "indigo",
        autoClose: 8_000,
      })
    } catch {
      /* Испорченный черновик не должен ломать форму. */
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGarageMode])

  /* Внутри Telegram приложение переспрашивает перед закрытием.

     Черновик здесь есть и восстанавливается, но человек о нём не
     знает: закрыв приложение свайпом посреди заполнения, он видит
     потерю, а не сохранение, и второй раз за форму не садится.
     Вопрос «точно закрыть?» стоит дешевле, чем брошенное объявление.

     Спрашиваем только когда есть что терять — по тому же признаку,
     что и черновик: марка или цена заполнены. */
  useTelegramClosingGuard(!isGarageMode && Boolean(f.make || f.model || f.price))

  useEffect(() => {
    if (isGarageMode) return
    /* Пауза между нажатиями клавиш: писать в хранилище на каждый символ
       незачем. */
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ f, images, savedAt: Date.now() }))
      } catch {
        /* Переполненное хранилище — не повод ронять форму. */
      }
    }, 800)
    return () => window.clearTimeout(timer)
  }, [f, images, isGarageMode])

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true)
    setCategoriesError(null)
    try {
      const data = await fetchJson<CategoriesResponse>("/api/categories")
      setCategories(Array.isArray(data.categories) ? data.categories : [])
    } catch (error) {
      setCategories([])
      setCategoriesError(error instanceof Error ? error.message : "Не удалось загрузить категории")
    } finally {
      setCategoriesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  useEffect(() => {
    if (!garageId || status !== "authenticated" || garagePrefillAttempted.current) return
    garagePrefillAttempted.current = true
    setGaragePrefillState("loading")
    void fetchJson<GarageVehicleResponse>(`/api/garage?id=${encodeURIComponent(garageId)}`)
      .then(({ vehicle }) => {
        setF((previous) => ({
          ...previous,
          title: previous.title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          make: vehicle.make,
          model: vehicle.model,
          year: String(vehicle.year),
          mileage: vehicle.mileage == null ? "" : String(vehicle.mileage),
          vin: vehicle.vin || "",
          fuelType: vehicle.fuelType || "GASOLINE",
          transmission: vehicle.transmission || "AUTOMATIC",
          bodyType: vehicle.bodyType || "SEDAN",
          color: vehicle.color || "",
          condition: vehicle.condition || "EXCELLENT",
          location: vehicle.location || "",
          doors: vehicle.doors == null ? "" : String(vehicle.doors),
          engineVolume: vehicle.engineVolume == null ? "" : String(vehicle.engineVolume),
          power: vehicle.power == null ? "" : String(vehicle.power),
          driveType: vehicle.driveType || "FWD",
          steeringWheel: vehicle.steeringWheel || "LEFT",
          ownersCount: vehicle.ownersCount == null ? "" : String(vehicle.ownersCount),
          documentsStatus: vehicle.documentsStatus || "CLEAN",
          damageInfo: vehicle.damageInfo || "NONE",
          sellerType: vehicle.sellerType || "OWNER",
          availability: vehicle.availability || "IN_STOCK",
          customsCleared: vehicle.customsCleared === false ? "false" : "true",
          generation: vehicle.generation || "",
          keywords: vehicle.keywords || "",
          description: vehicle.description || "",
          vehicleType: "CAR",
        }))
        replaceImages(parseImages(vehicle.images))
        setGaragePrefillState("loaded")
      })
      .catch(() => setGaragePrefillState("error"))
  }, [garageId, replaceImages, status])

  if (status === "loading") return <Center py={100}><Loader color="indigo" /></Center>
  if (!session) return null

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const numericString = (value: string | number) => value === "" ? "" : String(value)
  const setMake = (value: string) => setF((previous) => {
    const make = value.trimStart()
    return make === previous.make ? previous : { ...previous, make, model: "" }
  })
  const setVehicleType = (vehicleType: string) => setF((previous) => {
    /* Случайный клик по соседнему типу затирал четырнадцать заполненных
       полей без предупреждения. Если марка уже введена — спрашиваем;
       подтверждение через confirm, а не модалку: смена типа посреди
       заполнения — редкое действие, городить состояние ради него незачем. */
    if (previous.vehicleType !== vehicleType && (previous.make || previous.vin || previous.model)) {
      const agreed = window.confirm("Сменить тип транспорта? Марка, модель, VIN и характеристики будут очищены.")
      if (!agreed) return previous
    }
    return {
    ...previous,
    vehicleType,
    make: "",
    model: "",
    vin: "",
    serialNumber: "",
    registrationNumber: "",
    // Пустая строка вместо «OTHER»: подставлять «Другое» по умолчанию значило
    // заполнять поле за продавца тем, что покупателю ничего не говорит.
    fuelType: "",
    transmission: "",
    bodyType: "",
    driveType: "",
    condition: "",
    steeringWheel: "",
    ownersCount: "",
    documentsStatus: "",
    damageInfo: "",
    sellerType: "",
    availability: "",
    customsCleared: "",
    generation: "",
    }
  })
  const usageMeta = getUsageMeta(f.vehicleType)
  const identityMeta = getVehicleIdentityMeta(f.vehicleType)
  // В форме «Другое» не предлагаем — оно остаётся только для показа лотов,
  // импортированных из чужих каталогов.
  const fuelOptions = getSelectableFuelOptions(f.vehicleType)
  const transmissionOptions = getSelectableTransmissionOptions(f.vehicleType)
  const selectedCategory = categories.find((category) => category.vehicleType === f.vehicleType)
  const brandCategory = BRAND_CATEGORY_BY_VEHICLE_TYPE[f.vehicleType as keyof typeof BRAND_CATEGORY_BY_VEHICLE_TYPE] || "cars"
  const brandOptions = getBrandsByCategory(brandCategory)
  const modelOptions = f.make.trim() ? getModels(f.make.trim(), brandCategory) : []
  /* Обязательные характеристики считает общий с сервером модуль.

     Подтип нужен потому, что от него зависит набор: у полуприцепа нет ни
     мотора, ни коробки, ни одометра, и требовать их — тупик. Легкового это
     не касается, там кузов на набор не влияет. */
  const submittedSubtypeValue = f.vehicleType === "TRUCK" ? f.truckBodyType
    : f.vehicleType === "AIR" ? f.airType
    : ""
  const publicationInput = {
    make: f.make,
    model: f.model,
    vehicleType: f.vehicleType,
    year: f.year,
    price: f.price,
    location: f.location,
    vin: f.vin,
    serialNumber: f.serialNumber,
    registrationNumber: f.registrationNumber,
    description: f.description,
    images,
    mileage: f.mileage,
    operatingHours: f.operatingHours,
    flightHours: f.flightHours,
    transmission: f.transmission,
    fuelType: f.fuelType,
    engineVolume: f.engineVolume,
    power: f.power,
    subtype: submittedSubtypeValue,
    bodyType: f.bodyType,
    driveType: f.driveType,
    color: f.color,
    condition: f.condition,
    steeringWheel: f.steeringWheel,
    ownersCount: f.ownersCount,
    documentsStatus: f.documentsStatus,
    damageInfo: f.damageInfo,
    sellerType: f.sellerType,
    availability: f.availability,
    customsCleared: f.customsCleared === "" ? null : f.customsCleared === "true",
    generation: f.generation,
  }
  // В гараже карточка приватная и дополняется постепенно — там строгий набор
  // не нужен, он касается только того, что уходит в каталог.
  const publicationRequirements = isGarageMode ? [] : getVehiclePublicationRequirements(publicationInput)
  const missingRequirements = isGarageMode ? [] : getMissingVehiclePublicationRequirements(publicationInput)
  const requiredSpecFields = new Set<VehiclePublicationField>(publicationRequirements.map((requirement) => requirement.field))
  const missingFields = new Map<VehiclePublicationField, string>(missingRequirements.map((requirement) => [requirement.field, requirement.label]))
  const completedRequirementCount = publicationRequirements.length - missingRequirements.length
  const moderationReady = !isGarageMode && missingRequirements.length === 0
  const fieldError = (field: VehiclePublicationField) => submitAttempted ? missingFields.get(field) : undefined
  const subtypeControlField = f.vehicleType === "MOTORCYCLE" ? "motorcycleType"
    : f.vehicleType === "TRUCK" ? "truckBodyType"
    : f.vehicleType === "SPECIAL" ? "specialType"
    : f.vehicleType === "WATER" ? "waterType"
    : f.vehicleType === "AIR" ? "airType"
    : ""
  const focusRequirement = (field: VehiclePublicationField) => {
    const control = field === "subtype" ? subtypeControlField : field
    if (!control) return
    document.getElementById(`vehicle-field-${control}`)?.focus()
  }

  const isVehicleDetailsReady = Boolean(f.make && f.model && f.year && (isGarageMode || (f.price && f.location.trim())))
  const currentJourneyStep = images.length > 0 ? 2 : isVehicleDetailsReady ? 1 : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isGarageMode && (!f.make || !f.model || !f.year)) {
      notifications.show({ title: "Ошибка", message: "Заполните обязательные поля", color: "red" })
      return
    }
    if (!isGarageMode && !selectedCategory) {
      notifications.show({ title: "Категория недоступна", message: "Не удалось подобрать категорию для выбранного типа транспорта. Обновите страницу.", color: "red" })
      return
    }
    // Названо поимённо: в форме четыре десятка полей, и «заполните
    // обязательные» заставляет продавца искать пропуск глазами.
    if (missingRequirements.length > 0) {
      setSubmitAttempted(true)
      notifications.show({
        title: "Объявление пока не готово",
        message: `Заполните: ${missingRequirements.map((requirement) => requirement.label).join(", ")}.`,
        color: "orange",
      })
      requestAnimationFrame(() => focusRequirement(missingRequirements[0].field))
      return
    }
    setLoading(true)
    try {
      if (isGarageMode) {
        await fetchJson(isGarageEdit ? `/api/garage?id=${encodeURIComponent(garageId)}` : "/api/garage", {
          method: isGarageEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            make: f.make,
            model: f.model,
            year: Number(f.year),
            mileage: f.mileage ? Number(f.mileage) : null,
            vin: f.vin || null,
            fuelType: f.fuelType,
            transmission: f.transmission,
            bodyType: f.bodyType,
            color: f.color || null,
            doors: f.doors ? Number(f.doors) : null,
            engineVolume: f.engineVolume ? Number(f.engineVolume) : null,
            power: f.power ? Number(f.power) : null,
            driveType: f.driveType,
            condition: f.condition,
            steeringWheel: f.steeringWheel,
            ownersCount: f.ownersCount ? Number(f.ownersCount) : null,
            documentsStatus: f.documentsStatus,
            damageInfo: f.damageInfo,
            sellerType: f.sellerType,
            availability: f.availability,
            customsCleared: f.customsCleared === "" ? null : f.customsCleared === "true",
            generation: f.generation,
            keywords: f.keywords,
            location: f.location,
            description: f.description,
            images,
          }),
        })
        notifications.show({
          title: isGarageEdit ? "Данные обновлены" : "Автомобиль сохранён",
          message: isGarageEdit ? "Изменения сохранены в приватной карточке гаража." : "Приватная карточка добавлена в личный гараж.",
          color: "teal",
        })
        router.push(`/dashboard?tab=garage&${isGarageEdit ? "updated" : "created"}=garage`)
        return
      }

      // Сервер создаёт ТС и объявление в одной транзакции: не оставляем
      // транспорт без объявления, если сеть оборвётся между запросами.
      const vehicle = await fetchJson<CreateVehicleResponse>("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title || `${f.year} ${f.make} ${f.model}`,
          garageVehicleId: garageId || null,
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
          customsCleared: f.customsCleared === "" ? null : f.customsCleared === "true",
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
          categoryId: selectedCategory!.id,
        }),
      })

      /* Объявление создано — черновик больше не нужен: иначе следующая
         подача начнётся с данных прошлой машины. */
      try { window.localStorage.removeItem(DRAFT_STORAGE_KEY) } catch {}
      notifications.show({ title: "Отправлено на проверку", message: "Мы проверим объявление и опубликуем его после модерации.", color: "indigo" })
      const listingId = vehicle.listings[0]?.id
      router.push(`/dashboard?tab=listings${listingId ? `&created=${encodeURIComponent(listingId)}` : ""}`)
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
            <Group gap={7} align="center">
              <Text component="h1" c="var(--market-ink)" ff="var(--font-display),sans-serif">{isGarageEdit ? "Редактировать автомобиль" : isGarageMode ? "Добавить автомобиль в гараж" : "Новое объявление"}</Text>
              {isTelegramMiniApp && <Badge leftSection={<IconBrandTelegram size={12} />} color="indigo" variant="light" radius="xl">Mini App</Badge>}
            </Group>
            <Text size="xs" c="var(--market-muted)">{isGarageEdit ? "Обновите приватную карточку — в каталоге изменения не публикуются" : isGarageMode ? "Сохраните полную приватную карточку — в каталоге она не появится" : "Заполните данные — после проверки объявление появится в поиске"}</Text>
          </Stack>
        </Group>

        {garagePrefillState === "loading" && <Alert color="teal" variant="light" title="Загружаем автомобиль из гаража">Основные характеристики будут заполнены автоматически.</Alert>}
        {garagePrefillState === "loaded" && <Alert color="teal" variant="light" title={isGarageEdit ? "Карточка готова к редактированию" : "Данные из гаража подставлены"} icon={<IconCheck size={18} />}>{isGarageEdit ? "Измените нужные поля и сохраните — карточка останется приватной." : "Добавьте цену, фотографии и описание — после отправки объявление попадёт на модерацию."}</Alert>}
        {garagePrefillState === "error" && <Alert color="orange" variant="light" title="Не удалось прочитать запись гаража">Можно заполнить объявление вручную; приватная запись в гараже не изменилась.</Alert>}

        {isTelegramMiniApp && (
          <Alert color="indigo" variant="light" title="Быстрая подача из Telegram" icon={<IconBrandTelegram size={18} />}>
            Добавьте данные и снимите фото прямо с телефона — номер и аккаунт уже подтверждены ботом.
          </Alert>
        )}

        {isGarageMode && (
          <Alert color="teal" variant="light" title="Приватная карточка автомобиля" icon={<IconCar size={18} />}>
            Данные видны только вам. Позже из этой карточки можно создать объявление без повторного заполнения.
          </Alert>
        )}

        {categoriesError && (
          <Alert color="red" variant="light" title="Не удалось подготовить форму" withCloseButton onClose={() => setCategoriesError(null)}>
            <Group justify="space-between" gap="sm" wrap="wrap">
              <Text size="sm">{categoriesError}. Поля сохранены — повторите загрузку категорий.</Text>
              <Button size="xs" variant="light" color="red" loading={categoriesLoading} onClick={() => void loadCategories()}>Повторить</Button>
            </Group>
          </Alert>
        )}

        {!isGarageMode && (
          <Paper
            className="create-listing__readiness"
            data-ready={moderationReady || undefined}
            radius="md"
            p="md"
            withBorder
            aria-live="polite"
          >
            <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon color={moderationReady ? "teal" : "orange"} variant="light" radius="md" size={38}>
                  <IconCheck size={20} />
                </ThemeIcon>
                <Stack gap={1}>
                  <Text fw={800} fz="sm" c="var(--market-ink)">Готовность к модерации</Text>
                  <Text size="xs" c="var(--market-muted)">
                    {moderationReady
                      ? "Все обязательные сведения заполнены."
                      : `Заполнено ${completedRequirementCount} из ${publicationRequirements.length} обязательных пунктов.`}
                  </Text>
                </Stack>
              </Group>
              <Badge color={moderationReady ? "teal" : "orange"} variant="light" size="lg" radius="sm">
                {moderationReady ? "Готово" : `Осталось ${missingRequirements.length}`}
              </Badge>
            </Group>
            {!moderationReady && (
              <Group gap={6} mt="sm" wrap="wrap">
                {missingRequirements.slice(0, 7).map((requirement) => (
                  <Badge key={requirement.field} color="gray" variant="light" radius="sm" tt="none">
                    {requirement.label}
                  </Badge>
                ))}
                {missingRequirements.length > 7 && (
                  <Badge color="gray" variant="outline" radius="sm">+{missingRequirements.length - 7}</Badge>
                )}
              </Group>
            )}
          </Paper>
        )}

        <Paper className="create-listing__journey" radius="md" p="sm" withBorder>
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing={0}>
            {[
              { number: "01", label: isGarageMode ? "Автомобиль" : "Категория", description: isGarageMode ? "Легковой транспорт" : CATS.find((category) => category.value === f.vehicleType)?.label || "Транспорт" },
              { number: "02", label: isGarageMode ? "Характеристики" : "Данные объявления", description: isVehicleDetailsReady ? "Данные готовы" : isGarageMode ? "Марка, год и состояние" : "Марка, цена и характеристики" },
              { number: "03", label: isGarageMode ? "Фото и сохранение" : "Фото и публикация", description: images.length ? `Добавлено фото: ${images.length}` : isGarageMode ? "Фотографии можно добавить позже" : "Добавьте реальные фотографии" },
            ].map((step, index) => (
              <Group
                className="create-listing__journey-step"
                data-current={index === currentJourneyStep || undefined}
                data-complete={index < currentJourneyStep || undefined}
                gap="sm"
                key={step.number}
                wrap="nowrap"
              >
                <Text className="create-listing__journey-number">{step.number}</Text>
                <Stack gap={1}>
                  <Text size="xs" fw={800} c="var(--market-ink)">{step.label}</Text>
                  <Text size="11px" c="dimmed">{step.description}</Text>
                </Stack>
              </Group>
            ))}
          </SimpleGrid>
        </Paper>

        <form onSubmit={handleSubmit}>
          <Stack className={`${styles.listingCreateForm} create-listing__form`} gap="md">
            {/* Тип транспорта */}
            {!isGarageMode && <Paper className="create-listing__section" data-accent="indigo" radius="md" p="md" withBorder>
              <Group justify="space-between" mb="sm">
                <Text fw={700} fz="sm" c="var(--market-ink)">Тип транспорта</Text>
                <Badge size="sm" color="indigo" variant="light">Шаг 1</Badge>
              </Group>
              <SegmentedControl value={f.vehicleType} onChange={setVehicleType} data={CATS} size="sm" radius="md" fullWidth />
              {/* Что понадобится — до того, как продавец начал заполнять.
                  Иначе он упрётся в ошибку на последнем шаге и бросит форму. */}
              <Text size="xs" c="var(--market-muted)" mt="xs">{describeRequiredSpecs(f.vehicleType)}</Text>
            </Paper>}

            {/* Основное */}
            <Paper className="create-listing__section" radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={1}>
                    <Text fw={700} fz="sm" c="var(--market-ink)">Основная информация</Text>
                    <Text size="xs" c="dimmed">Данные, по которым покупатель найдёт транспорт.</Text>
                  </Stack>
                  <Badge size="sm" color="gray" variant="light">Шаг 2</Badge>
                </Group>
                {!isGarageMode && <TextInput label="Заголовок (необязательно)" description="Если оставить пустым, подставим год, марку и модель." placeholder="Например, Toyota Camry в отличном состоянии" value={f.title} onChange={(e) => set("title", e.target.value)} size="sm" />}
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <Autocomplete
                    id="vehicle-field-make"
                    className="create-listing__catalog-autocomplete"
                    label="Марка"
                    placeholder="Toyota"
                    description="Начните вводить или выберите из каталога"
                    required
                    error={fieldError("make")}
                    value={f.make}
                    onChange={setMake}
                    onClear={() => setF((previous) => ({ ...previous, make: "", model: "" }))}
                    onOptionSubmit={setMake}
                    clearable
                    clearButtonProps={{ "aria-label": "Сбросить марку", title: "Сбросить марку" }}
                    openOnFocus
                    size="sm"
                    data={brandOptions.map((brand) => brand.name)}
                    leftSection={f.make.trim() ? <BrandIcon brand={f.make.trim()} size={20} variant="rounded" /> : <IconCar size={16} />}
                    renderOption={({ option }) => (
                      <Group gap="xs" wrap="nowrap">
                        <BrandIcon brand={option.value} size={24} variant="rounded" />
                        <Text size="sm" fw={600}>{option.value}</Text>
                      </Group>
                    )}
                  />
                  <Autocomplete
                    id="vehicle-field-model"
                    className="create-listing__catalog-autocomplete"
                    label="Модель"
                    placeholder={f.make ? "Выберите или введите модель" : "Сначала укажите марку"}
                    description={f.make && modelOptions.length === 0 ? "Модель можно указать вручную" : undefined}
                    required
                    error={fieldError("model")}
                    disabled={!f.make.trim()}
                    value={f.model}
                    onChange={(value) => set("model", value)}
                    onClear={() => set("model", "")}
                    clearable
                    clearButtonProps={{ "aria-label": "Сбросить модель", title: "Сбросить модель" }}
                    openOnFocus
                    size="sm"
                    data={modelOptions}
                    leftSection={f.make.trim() ? <BrandIcon brand={f.make.trim()} size={20} variant="rounded" /> : <IconCar size={16} />}
                  />
                </SimpleGrid>
                <SimpleGrid cols={{ base: 1, sm: isGarageMode ? 2 : 3 }} spacing="sm">
                  <NumberInput id="vehicle-field-year" label="Год" placeholder="2018" required value={f.year ? Number(f.year) : undefined} onChange={(v) => set("year", numericString(v))} error={fieldError("year")} size="sm" min={1886} max={new Date().getFullYear() + 1} />
                  {!isGarageMode && <NumberInput id="vehicle-field-price" label="Цена, ₽" placeholder="1500000" required value={f.price ? Number(f.price) : undefined} onChange={(v) => set("price", numericString(v))} error={fieldError("price")} size="sm" min={1} />}
                  <NumberInput id={`vehicle-field-${usageMeta.field}`} label={`${usageMeta.label}, ${usageMeta.unit}`} required={requiredSpecFields.has(usageMeta.field)} placeholder={usageMeta.field === "mileage" ? "120 000" : "2 500"} value={usageMeta.field === "flightHours" ? (f.flightHours ? Number(f.flightHours) : undefined) : usageMeta.field === "operatingHours" ? (f.operatingHours ? Number(f.operatingHours) : undefined) : (f.mileage ? Number(f.mileage) : undefined)} onChange={(v) => set(usageMeta.field, numericString(v))} error={fieldError(usageMeta.field)} size="sm" min={0} />
                </SimpleGrid>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput id="vehicle-field-location" label="Город" placeholder="Москва" required={!isGarageMode} value={f.location} onChange={(e) => set("location", e.target.value)} error={fieldError("location")} size="sm" />
                  <TextInput id={`vehicle-field-${identityMeta.field}`} label={identityMeta.label} placeholder={identityMeta.placeholder} value={identityMeta.field === "vin" ? f.vin : identityMeta.field === "serialNumber" ? f.serialNumber : f.registrationNumber} onChange={(e) => set(identityMeta.field, e.target.value.toUpperCase())} error={fieldError(identityMeta.field)} size="sm" maxLength={identityMeta.maxLength} required={!isGarageMode} description={isGarageMode ? "Необязательно. VIN поможет быстро создать объявление позже." : identityMeta.description} />
                </SimpleGrid>
              </Stack>
            </Paper>

            {/* Характеристики */}
            <Paper className="create-listing__section" radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="var(--market-ink)">Характеристики</Text>
                <SimpleGrid cols={{ base: 1, sm: f.vehicleType === "CAR" ? 3 : 2 }} spacing="sm">
                  <Select id="vehicle-field-fuelType" label={f.vehicleType === "AIR" ? "Тип топлива" : "Топливо"} placeholder="Выберите" required={requiredSpecFields.has("fuelType")} data={fuelOptions.map(t => ({ value: t.value, label: t.label }))} value={f.fuelType || null} onChange={(v) => set("fuelType", v || "")} error={fieldError("fuelType")} size="sm" />
                  {supportsTransmission(f.vehicleType) && <Select id="vehicle-field-transmission" label="КПП" placeholder="Выберите" required={requiredSpecFields.has("transmission")} data={transmissionOptions.map(t => ({ value: t.value, label: t.label }))} value={f.transmission || null} onChange={(v) => set("transmission", v || "")} error={fieldError("transmission")} size="sm" />}
                  {f.vehicleType === "CAR" && <Select id="vehicle-field-driveType" label="Привод" placeholder="Выберите" required={requiredSpecFields.has("driveType")} data={DRIVE_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.driveType || null} onChange={(v) => set("driveType", v || "")} error={fieldError("driveType")} size="sm" />}
                </SimpleGrid>
                {f.vehicleType === "CAR" && (
                  <Select id="vehicle-field-bodyType" label="Тип кузова" placeholder="Выберите" required={requiredSpecFields.has("bodyType")} data={BODY_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.bodyType || null} onChange={(v) => set("bodyType", v || "")} error={fieldError("bodyType")} size="sm" />
                )}
                {f.vehicleType === "MOTORCYCLE" && (
                  <Group gap="sm" grow>
                    <Select id="vehicle-field-motorcycleType" label="Тип мотоцикла" placeholder="Выберите" required={requiredSpecFields.has("subtype")} data={MOTORCYCLE_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.motorcycleType || null} onChange={(v) => set("motorcycleType", v || "")} error={fieldError("subtype")} size="sm" />
                    <Select label="Главная передача" data={[{ value: "CHAIN", label: "Цепь" }, { value: "SHAFT", label: "Кардан" }, { value: "BELT", label: "Ремень" }]} value={f.finalDrive} onChange={(v) => set("finalDrive", v || "")} size="sm" />
                    <Select label="Тактность" data={[{ value: "2T", label: "2T" }, { value: "4T", label: "4T" }]} value={f.strokeCycle} onChange={(v) => set("strokeCycle", v || "")} size="sm" />
                  </Group>
                )}
                {f.vehicleType === "TRUCK" && (
                  <Stack gap="sm">
                    <Group gap="sm" grow>
                      <Select id="vehicle-field-truckBodyType" label="Тип кузова / прицепа" placeholder="Выберите" required={requiredSpecFields.has("subtype")} data={TRUCK_BODY_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.truckBodyType || null} onChange={(v) => set("truckBodyType", v || "")} error={fieldError("subtype")} size="sm" />
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
                    <Select id="vehicle-field-specialType" label="Вид спецтехники" placeholder="Выберите" required={requiredSpecFields.has("subtype")} data={SPECIAL_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.specialType || null} onChange={(v) => set("specialType", v || "")} error={fieldError("subtype")} size="sm" />
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
                      <Select id="vehicle-field-waterType" label="Тип водного транспорта" placeholder="Выберите" required={requiredSpecFields.has("subtype")} data={WATER_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.waterType || null} onChange={(v) => set("waterType", v || "")} error={fieldError("subtype")} size="sm" />
                      <Select label="Материал корпуса" data={HULL_MATERIALS.map(t => ({ value: t.value, label: t.label }))} value={f.hullMaterial} onChange={(v) => set("hullMaterial", v || "")} size="sm" />
                      <Select label="Тип мотора" data={[{ value: "OUTBOARD", label: "Подвесной" }, { value: "INBOARD", label: "Стационарный" }, { value: "JET", label: "Водомёт" }]} value={f.waterEngineType} onChange={(v) => set("waterEngineType", v || "")} size="sm" />
                    </Group>
                    <NumberInput label="Длина корпуса, м" value={f.hullLengthM ? Number(f.hullLengthM) : undefined} onChange={(v) => set("hullLengthM", String(v || ""))} size="sm" min={0} decimalScale={2} />
                  </Stack>
                )}
                {f.vehicleType === "AIR" && (
                  <Stack gap="sm">
                    <Group gap="sm" grow>
                      <Select id="vehicle-field-airType" label="Категория ВС" placeholder="Выберите" required={requiredSpecFields.has("subtype")} data={AIR_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.airType || null} onChange={(v) => set("airType", v || "")} error={fieldError("subtype")} size="sm" />
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
                  {/* Объём в литрах спрашивается там, где он есть. У электротяги
                      и воздушного судна его нет — вместо него обязательна
                      мощность, она есть у любой силовой установки. */}
                  <TextInput id="vehicle-field-engineVolume" label="Объём двигателя, л" required={requiredSpecFields.has("engineVolume")} placeholder="2.0" value={f.engineVolume} onChange={(e) => set("engineVolume", e.target.value)} error={fieldError("engineVolume")} size="sm" type="number" min="0.1" max="100" step="0.1" />
                  <TextInput id="vehicle-field-power" label="Мощность, л.с." required={requiredSpecFields.has("power")} placeholder="150" value={f.power} onChange={(e) => set("power", e.target.value)} error={fieldError("power")} size="sm" type="number" min="1" max="100000" />
                  <TextInput id="vehicle-field-color" label="Цвет" required={requiredSpecFields.has("color")} placeholder="Белый" value={f.color} onChange={(e) => set("color", e.target.value)} error={fieldError("color")} size="sm" />
                </Group>
                <Stack gap={6}>
                  <Text size="xs" fw={700} c="dimmed">Состояние{requiredSpecFields.has("condition") ? " *" : ""}</Text>
                  <Group gap={6}>
                    {CONDITIONS.map((item) => (
                      <Chip
                        id={item.value === CONDITIONS[0]?.value ? "vehicle-field-condition" : undefined}
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
                  {fieldError("condition") && <Text size="xs" c="var(--market-danger-text)">{fieldError("condition")}</Text>}
                </Stack>
                {requiredSpecFields.has("steeringWheel") && <Select id="vehicle-field-steeringWheel" label="Руль" placeholder="Выберите" required data={STEERING_WHEELS.map(t => ({ value: t.value, label: t.label }))} value={f.steeringWheel || null} onChange={(v) => set("steeringWheel", v || "")} error={fieldError("steeringWheel")} size="sm" />}
              </Stack>
            </Paper>

            {/* Документы и состояние */}
            <Paper className="create-listing__section" radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="var(--market-ink)">Документы и состояние</Text>
                <Group gap="sm" grow>
                  <Select id="vehicle-field-documentsStatus" label="Документы" placeholder="Выберите" required={requiredSpecFields.has("documentsStatus")} data={DOCUMENT_STATUSES.map(t => ({ value: t.value, label: t.label }))} value={f.documentsStatus || null} onChange={(v) => set("documentsStatus", v || "")} error={fieldError("documentsStatus")} size="sm" />
                  <Select id="vehicle-field-damageInfo" label="Повреждения" placeholder="Выберите" required={requiredSpecFields.has("damageInfo")} data={DAMAGE_INFO.map(t => ({ value: t.value, label: t.label }))} value={f.damageInfo || null} onChange={(v) => set("damageInfo", v || "")} error={fieldError("damageInfo")} size="sm" />
                </Group>
                <Group gap="sm" grow>
                  {requiredSpecFields.has("ownersCount") && <NumberInput id="vehicle-field-ownersCount" label="Владельцев по ПТС" placeholder="1" required value={f.ownersCount === "" ? undefined : Number(f.ownersCount)} onChange={(v) => set("ownersCount", numericString(v))} error={fieldError("ownersCount")} size="sm" min={0} max={100} />}
                  <Select id="vehicle-field-sellerType" label="Продавец" placeholder="Выберите" required={requiredSpecFields.has("sellerType")} data={SELLER_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.sellerType || null} onChange={(v) => set("sellerType", v || "")} error={fieldError("sellerType")} size="sm" />
                  {f.vehicleType === "CAR" && <TextInput id="vehicle-field-generation" label="Поколение" placeholder="VII (XV50)" required={requiredSpecFields.has("generation")} value={f.generation} onChange={(e) => set("generation", e.target.value)} error={fieldError("generation")} size="sm" />}
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <Stack gap={6}>
                    <Text size="xs" fw={700} c="dimmed">Наличие{requiredSpecFields.has("availability") ? " *" : ""}</Text>
                    <SegmentedControl
                      id="vehicle-field-availability"
                      value={f.availability}
                      onChange={(value) => set("availability", value)}
                      data={AVAILABILITY_TYPES.map((item) => ({ value: item.value, label: item.label }))}
                      size="sm"
                      radius="md"
                      fullWidth
                    />
                    {fieldError("availability") && <Text size="xs" c="var(--market-danger-text)">{fieldError("availability")}</Text>}
                  </Stack>
                  <Stack gap={6}>
                    <Text size="xs" fw={700} c="dimmed">Растаможен{requiredSpecFields.has("customsCleared") ? " *" : ""}</Text>
                    <SegmentedControl
                      id="vehicle-field-customsCleared"
                      value={f.customsCleared}
                      onChange={(value) => set("customsCleared", value)}
                      data={[{ value: "true", label: "Да" }, { value: "false", label: "Нет" }]}
                      size="sm"
                      radius="md"
                      fullWidth
                    />
                    {fieldError("customsCleared") && <Text size="xs" c="var(--market-danger-text)">{fieldError("customsCleared")}</Text>}
                  </Stack>
                </SimpleGrid>
              </Stack>
            </Paper>

            {/* Описание */}
            <Paper className="create-listing__section" radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="var(--market-ink)">Описание</Text>
                <Textarea id="vehicle-field-description" label="Подробное описание" description={`${f.description.trim().length}/40 символов минимум`} placeholder="Опишите состояние, историю обслуживания, комплектацию и известные недостатки" required={!isGarageMode} value={f.description} onChange={(e) => set("description", e.target.value)} error={fieldError("description")} size="sm" minRows={4} autosize />
                <TextInput label="Ключевые слова" placeholder='"один хозяин", ксенон, панорама...' value={f.keywords} onChange={(e) => set("keywords", e.target.value)} size="sm" />
                <Text size="xs" c="var(--market-muted)">Ключевые слова помогают найти ваше объявление</Text>
              </Stack>
            </Paper>

            <Paper className="create-listing__section" data-accent="indigo" radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Group gap="sm">
                    <ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconPhoto size={18} /></ThemeIcon>
                    <Stack gap={0}>
                      <Text fw={700} fz="sm" c="var(--market-ink)">Фотографии транспорта</Text>
                      <Text size="xs" c="var(--market-muted)">{isTelegramMiniApp ? "Можно снять авто камерой или выбрать фото из галереи. " : ""}Первая фотография станет обложкой. До 12 JPG, PNG или WebP — до 10 МБ каждая.</Text>
                    </Stack>
                  </Group>
                  <Badge variant="light" color={images.length ? "indigo" : "gray"}>{images.length}/12</Badge>
                </Group>
                <FileInput
                  id="vehicle-field-images"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  clearable
                  /* Без capture. Он открывает камеру сразу и отрезает
                     галерею, а машину фотографируют заранее — при мойке,
                     на свету, с разных сторон. Подпись обещала «снять или
                     выбрать», выбрать при этом было нельзя.

                     На карте АЗС capture остаётся: там снимок колонки
                     делается на месте и прямо сейчас. */
                  disabled={uploadingImages || images.length >= 12}
                  placeholder="Выберите или снимите фотографии"
                  onChange={uploadPhotos}
                  leftSection={<IconPhoto size={16} />}
                  error={fieldError("images")}
                />
                <ListingPhotoGrid images={images} uploading={uploadingImages} onRemove={removeImage} />
              </Stack>
            </Paper>

            {/* Кнопка */}
            <Paper className={styles.submitPanel} radius="md" p="sm" withBorder>
              <Stack gap={6}>
                <Button fullWidth type="submit" size="md" color={isGarageMode ? "teal" : "indigo"} loading={loading} disabled={(!isGarageMode && !selectedCategory) || uploadingImages} leftSection={<IconCheck size={18} />}>
                  {loading ? (isGarageMode ? "Сохраняем..." : "Публикация...") : (isGarageEdit ? "Сохранить изменения" : isGarageMode ? "Сохранить в личный гараж" : "Отправить на модерацию")}
                </Button>
                <Text size="xs" c="dimmed" ta="center">{isGarageMode ? "Карточка останется приватной. Опубликовать её можно отдельным действием из гаража." : "Сначала объявление проверит модератор. Статус появится в личном кабинете."}</Text>
              </Stack>
            </Paper>
          </Stack>
        </form>
      </Stack>
    </Container>
  )
}
