"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import {
  Alert,
  Badge,
  Button,
  Container,
  FileInput,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Select,
  Textarea,
  TextInput,
  ThemeIcon,
} from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconAlertTriangle, IconArrowLeft, IconCheck, IconEdit, IconPhoto } from "@tabler/icons-react"
import { AsyncErrorState, EmptyState } from "@/components/ui/AsyncStates"
import { parseImages } from "@/lib/format"
import ListingPhotoGrid from "@/components/uploads/ListingPhotoGrid"
import { LISTING_STATUS_META } from "@/lib/listing-lifecycle"
import { useMarketplaceImageUpload } from "@/hooks/useMarketplaceImageUpload"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { isAdmin } from "@/lib/permissions"
import { AVAILABILITY_TYPES, BODY_TYPES, CONDITIONS, DAMAGE_INFO, DOCUMENT_STATUSES, DRIVE_TYPES, SELLER_TYPES, STEERING_WHEELS, getSelectableFuelOptions, getSelectableTransmissionOptions, getUsageMeta, getVehicleIdentityMeta, supportsTransmission } from "@/lib/constants"
import { getMissingVehiclePublicationRequirements, getVehiclePublicationRequirements, readStoredVehicleSubtype } from "@/lib/vehicle-publication-readiness"

type EditableSubject = {
  id: string
  make?: string
  model?: string
  year?: number
  price?: number
  location: string
  images: string | null
  /* Характеристики машины. У запчасти их нет — поля необязательные. */
  vehicleType?: string | null
  mileage?: number | null
  operatingHours?: number | null
  flightHours?: number | null
  fuelType?: string | null
  transmission?: string | null
  engineVolume?: number | null
  power?: number | null
  vin?: string | null
  serialNumber?: string | null
  registrationNumber?: string | null
  bodyType?: string | null
  driveType?: string | null
  color?: string | null
  condition?: string | null
  steeringWheel?: string | null
  ownersCount?: number | null
  documentsStatus?: string | null
  damageInfo?: string | null
  sellerType?: string | null
  availability?: string | null
  customsCleared?: boolean | null
  generation?: string | null
  typeDetails?: string | null
}
type EditableListing = {
  id: string
  userId: string
  title: string
  description: string | null
  price: number
  status: keyof typeof LISTING_STATUS_META
  vehicle: EditableSubject | null
  part: EditableSubject | null
}

type ListingResponse = { listing: EditableListing }
type FormState = {
  title: string
  description: string
  price: string
  location: string
  reason: string
  /* Характеристики хранятся строками: поле ввода отдаёт строку, а пустая
     означает «убрать значение». */
  usage: string
  fuelType: string
  transmission: string
  engineVolume: string
  power: string
  identity: string
  bodyType: string
  driveType: string
  color: string
  condition: string
  steeringWheel: string
  ownersCount: string
  documentsStatus: string
  damageInfo: string
  sellerType: string
  availability: string
  customsCleared: string
  generation: string
}
type UpdateListingResponse = { requiresRemoderation?: boolean }

export default function EditListingPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const { data, error, isLoading, mutate } = useSWR<ListingResponse>(params.id ? `/api/listings/${params.id}` : null, fetchJson)
  const { images, uploadingImages, uploadPhotos, removeImage, replaceImages } = useMarketplaceImageUpload()
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(`/listings/${params.id}/edit`)}`)
    }
  }, [params.id, router, sessionStatus])

  useEffect(() => {
    if (!data?.listing) return
    const subject = data.listing.vehicle || data.listing.part
    if (!subject) return
    const identityMeta = getVehicleIdentityMeta(data.listing.vehicle?.vehicleType || "CAR")
    setForm({
      title: data.listing.title,
      description: data.listing.description || "",
      price: String(data.listing.price),
      location: subject.location,
      reason: "",
      usage: String(subject.mileage ?? subject.operatingHours ?? subject.flightHours ?? ""),
      fuelType: subject.fuelType || "",
      transmission: subject.transmission || "",
      engineVolume: subject.engineVolume != null ? String(subject.engineVolume) : "",
      power: subject.power != null ? String(subject.power) : "",
      identity: data.listing.vehicle
        ? String(data.listing.vehicle[identityMeta.field] || "")
        : "",
      bodyType: subject.bodyType || "",
      driveType: subject.driveType || "",
      color: subject.color || "",
      condition: subject.condition || "",
      steeringWheel: subject.steeringWheel || "",
      ownersCount: subject.ownersCount == null ? "" : String(subject.ownersCount),
      documentsStatus: subject.documentsStatus || "",
      damageInfo: subject.damageInfo || "",
      sellerType: subject.sellerType || "",
      availability: subject.availability || "",
      customsCleared: subject.customsCleared == null ? "" : subject.customsCleared ? "true" : "false",
      generation: subject.generation || "",
    })
    replaceImages(parseImages(subject.images))
  }, [data, replaceImages])

  if (sessionStatus === "loading" || isLoading) {
    return <Container size="sm" py="xl"><Stack gap="md"><Skeleton height={36} width="42%" /><Skeleton height={260} radius="lg" /></Stack></Container>
  }
  if (!session) return null
  if (error) return <Container size="sm" py="xl"><AsyncErrorState title="Не удалось открыть редактор" description={error.message} onRetry={() => void mutate()} backHref="/dashboard" backLabel="В кабинет" /></Container>
  if (!data?.listing || !form) return <Container size="sm" py="xl"><EmptyState title="Объявление не найдено" description="Возможно, оно было удалено или перенесено в архив." actionLabel="В кабинет" actionHref="/dashboard" /></Container>
  // Администратор правит чужие карточки при модерации: раньше кнопка на
  // странице объявления вела сюда, а страница отвечала отказом.
  const canEdit = data.listing.userId === session.user.id || isAdmin(session.user.role)
  if (!canEdit) return <Container size="sm" py="xl"><EmptyState title="Редактирование недоступно" description="Изменять карточку может только её владелец." actionLabel="Вернуться к объявлениям" actionHref="/" /></Container>

  const subject = data.listing.vehicle || data.listing.part
  const isVehicle = Boolean(data.listing.vehicle)
  /* Вид транспорта задаёт и подпись счётчика, и наборы топлива с коробкой:
     у спецтехники моточасы, у самолёта — часы налёта. */
  const vehicleType = data.listing.vehicle?.vehicleType || "CAR"
  const usageMeta = getUsageMeta(vehicleType)
  const identityMeta = getVehicleIdentityMeta(vehicleType)
  const editPublicationInput = isVehicle ? {
    ...data.listing.vehicle!,
    price: form.price,
    location: form.location,
    description: form.description,
    images,
    [usageMeta.field]: form.usage,
    fuelType: form.fuelType,
    transmission: form.transmission,
    engineVolume: form.engineVolume,
    power: form.power,
    [identityMeta.field]: form.identity,
    bodyType: form.bodyType,
    driveType: form.driveType,
    color: form.color,
    condition: form.condition,
    steeringWheel: form.steeringWheel,
    ownersCount: form.ownersCount,
    documentsStatus: form.documentsStatus,
    damageInfo: form.damageInfo,
    sellerType: form.sellerType,
    availability: form.availability,
    customsCleared: form.customsCleared === "" ? null : form.customsCleared === "true",
    generation: form.generation,
    subtype: readStoredVehicleSubtype(vehicleType, data.listing.vehicle?.typeDetails),
  } : null
  const editRequirements = editPublicationInput ? getVehiclePublicationRequirements(editPublicationInput) : []
  const missingEditRequirements = editPublicationInput ? getMissingVehiclePublicationRequirements(editPublicationInput) : []
  const requiredEditFields = new Set(editRequirements.map((requirement) => requirement.field))
  const editReady = !isVehicle || missingEditRequirements.length === 0
  const detailHref = subject ? `/listings/${isVehicle ? "vehicle" : "part"}/${subject.id}` : "/dashboard"
  const statusMeta = LISTING_STATUS_META[data.listing.status] || LISTING_STATUS_META.DRAFT

  const updateForm = (key: keyof FormState, value: string) => setForm((current) => current ? { ...current, [key]: value } : current)
  const save = async () => {
    const price = Number(form.price)
    if (!form.title.trim() || !Number.isSafeInteger(price) || price < 0 || !form.location.trim()) {
      notifications.show({ title: "Проверьте поля", message: "Укажите заголовок, целую цену и город.", color: "red" })
      return
    }
    if (!editReady) {
      notifications.show({
        title: "Объявление пока не готово",
        message: `Заполните: ${missingEditRequirements.map((requirement) => requirement.label).join(", ")}.`,
        color: "orange",
      })
      return
    }
    setSaving(true)
    try {
      const payload = await fetchJson<UpdateListingResponse>(`/api/listings/${data.listing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price,
          location: form.location,
          images,
          reason: form.reason,
          ...(isVehicle
            ? {
                [usageMeta.field]: form.usage === "" ? null : Number(form.usage),
                fuelType: form.fuelType || null,
                transmission: supportsTransmission(vehicleType) ? form.transmission || null : undefined,
                engineVolume: form.engineVolume === "" ? null : Number(form.engineVolume),
                power: form.power === "" ? null : Number(form.power),
                [identityMeta.field]: form.identity || null,
                bodyType: form.bodyType || null,
                driveType: form.driveType || null,
                color: form.color || null,
                condition: form.condition,
                steeringWheel: form.steeringWheel || null,
                ownersCount: form.ownersCount === "" ? null : Number(form.ownersCount),
                documentsStatus: form.documentsStatus || null,
                damageInfo: form.damageInfo || null,
                sellerType: form.sellerType || null,
                availability: form.availability || null,
                customsCleared: form.customsCleared === "" ? null : form.customsCleared === "true",
                generation: form.generation || null,
              }
            : {}),
        }),
      })
      notifications.show({
        title: payload.requiresRemoderation ? "Изменения отправлены на проверку" : "Изменения сохранены",
        message: payload.requiresRemoderation ? "Карточка временно скрыта из поиска до решения модератора." : "Данные карточки обновлены.",
        color: payload.requiresRemoderation ? "indigo" : "teal",
      })
      router.push(detailHref)
      router.refresh()
    } catch (saveError) {
      notifications.show({ title: "Не удалось сохранить", message: getApiClientErrorMessage(saveError, "Повторите попытку."), color: "red" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container size="sm" py={{ base: "md", sm: "xl" }}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group gap="sm">
            <ThemeIcon size={46} radius="md" variant="light" color="indigo"><IconEdit size={23} /></ThemeIcon>
            <Stack gap={1}>
              <Text component="h1">Редактирование объявления</Text>
              <Text size="sm" c="dimmed">Сохраняются только данные этой карточки. Все изменения остаются в истории.</Text>
            </Stack>
          </Group>
          <Badge color={statusMeta.color} variant="light" size="lg">{statusMeta.label}</Badge>
        </Group>

        {data.listing.status === "ACTIVE" && (
          <Alert color="indigo" variant="light" icon={<IconAlertTriangle size={18} />} title="После сохранения нужна повторная модерация">
            Карточка временно исчезнет из поиска, пока модератор не подтвердит обновлённые данные.
          </Alert>
        )}

        {isVehicle && (
          <Alert
            color={editReady ? "teal" : "orange"}
            variant="light"
            icon={editReady ? <IconCheck size={18} /> : <IconAlertTriangle size={18} />}
            title={editReady ? "Карточка готова к модерации" : `Заполнено ${editRequirements.length - missingEditRequirements.length} из ${editRequirements.length} обязательных пунктов`}
          >
            {editReady
              ? "Все сведения, которые нужны покупателю и модератору, заполнены."
              : `Осталось: ${missingEditRequirements.map((requirement) => requirement.label).join(", ")}.`}
          </Alert>
        )}

        <Paper withBorder radius="md" p={{ base: "md", sm: "lg" }}>
          <Stack gap="md">
            <Text fw={700}>Основные данные</Text>
            <TextInput label="Заголовок" required value={form.title} onChange={(event) => updateForm("title", event.currentTarget.value)} maxLength={200} />
            <Group grow align="flex-start">
              <TextInput label="Цена, ₽" required inputMode="numeric" value={form.price} onChange={(event) => updateForm("price", event.currentTarget.value.replace(/\D/g, ""))} />
              <TextInput label="Город" required value={form.location} onChange={(event) => updateForm("location", event.currentTarget.value)} maxLength={120} />
            </Group>
            <Textarea label="Описание" required={isVehicle} value={form.description} onChange={(event) => updateForm("description", event.currentTarget.value)} minRows={5} autosize maxLength={5000} description={isVehicle ? `${form.description.trim().length}/40 символов минимум` : `${form.description.length}/5000`} />

            {/* Характеристики машины.

                Прежде их нельзя было править вовсе: объявление, поданное
                до введения обязательных полей, оставалось неполным
                навсегда — покупатель не понимал, что за машина.

                Счётчик подписан по виду техники: у спецтехники и катера
                моточасы, у воздушного судна — часы налёта. */}
            {isVehicle && (
              <>
                <Text fw={700} mt="xs">Характеристики</Text>
                <Text size="xs" c="dimmed" mt={-8}>
                  Покупатель выбирает по ним. Объявление без года, пробега, коробки и топлива читается как неполное.
                </Text>
                <Group grow align="flex-start">
                  <TextInput
                    label={`${usageMeta.label}, ${usageMeta.unit}`}
                    required={requiredEditFields.has(usageMeta.field)}
                    inputMode="numeric"
                    value={form.usage}
                    onChange={(event) => updateForm("usage", event.currentTarget.value.replace(/\D/g, ""))}
                  />
                  <Select
                    label="Топливо"
                    required={requiredEditFields.has("fuelType")}
                    placeholder="Выберите"
                    data={getSelectableFuelOptions(vehicleType)}
                    value={form.fuelType || null}
                    onChange={(value) => updateForm("fuelType", value || "")}
                    clearable
                  />
                </Group>
                <Group grow align="flex-start">
                  {supportsTransmission(vehicleType) && (
                    <Select
                      label="Коробка передач"
                      required={requiredEditFields.has("transmission")}
                      placeholder="Выберите"
                      data={getSelectableTransmissionOptions(vehicleType)}
                      value={form.transmission || null}
                      onChange={(value) => updateForm("transmission", value || "")}
                      clearable
                    />
                  )}
                  <TextInput
                    label="Объём двигателя, л"
                    required={requiredEditFields.has("engineVolume")}
                    inputMode="decimal"
                    placeholder="1.6"
                    value={form.engineVolume}
                    onChange={(event) => updateForm("engineVolume", event.currentTarget.value.replace(/[^\d.]/g, ""))}
                  />
                  <TextInput
                    label="Мощность, л.с."
                    required={requiredEditFields.has("power")}
                    inputMode="numeric"
                    placeholder="150"
                    value={form.power}
                    onChange={(event) => updateForm("power", event.currentTarget.value.replace(/\D/g, ""))}
                  />
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput
                    label={identityMeta.label}
                    description={identityMeta.description}
                    placeholder={identityMeta.placeholder}
                    required
                    value={form.identity}
                    maxLength={identityMeta.maxLength}
                    onChange={(event) => updateForm("identity", event.currentTarget.value.toUpperCase())}
                  />
                  <TextInput label="Цвет" placeholder="Белый" required value={form.color} onChange={(event) => updateForm("color", event.currentTarget.value)} />
                  {vehicleType === "CAR" && <Select label="Тип кузова" placeholder="Выберите" required data={BODY_TYPES} value={form.bodyType || null} onChange={(value) => updateForm("bodyType", value || "")} />}
                  {vehicleType === "CAR" && <Select label="Привод" placeholder="Выберите" required data={DRIVE_TYPES} value={form.driveType || null} onChange={(value) => updateForm("driveType", value || "")} />}
                  <Select label="Состояние" placeholder="Выберите" required data={CONDITIONS} value={form.condition || null} onChange={(value) => updateForm("condition", value || "")} />
                  {(vehicleType === "CAR" || vehicleType === "TRUCK") && <Select label="Руль" placeholder="Выберите" required data={STEERING_WHEELS} value={form.steeringWheel || null} onChange={(value) => updateForm("steeringWheel", value || "")} />}
                  {["CAR", "MOTORCYCLE", "TRUCK"].includes(vehicleType) && <TextInput label="Владельцев по ПТС" inputMode="numeric" required value={form.ownersCount} onChange={(event) => updateForm("ownersCount", event.currentTarget.value.replace(/\D/g, ""))} />}
                  {vehicleType === "CAR" && <TextInput label="Поколение" placeholder="VII (XV50)" required value={form.generation} onChange={(event) => updateForm("generation", event.currentTarget.value)} />}
                  <Select label="Документы" placeholder="Выберите" required data={DOCUMENT_STATUSES} value={form.documentsStatus || null} onChange={(value) => updateForm("documentsStatus", value || "")} />
                  <Select label="Повреждения" placeholder="Выберите" required data={DAMAGE_INFO} value={form.damageInfo || null} onChange={(value) => updateForm("damageInfo", value || "")} />
                  <Select label="Продавец" placeholder="Выберите" required data={SELLER_TYPES} value={form.sellerType || null} onChange={(value) => updateForm("sellerType", value || "")} />
                  <Select label="Наличие" placeholder="Выберите" required data={AVAILABILITY_TYPES} value={form.availability || null} onChange={(value) => updateForm("availability", value || "")} />
                </SimpleGrid>
                <Stack gap={6}>
                  <Text size="xs" fw={700} c="dimmed">Растаможен *</Text>
                  <SegmentedControl
                    value={form.customsCleared}
                    onChange={(value) => updateForm("customsCleared", value)}
                    data={[{ value: "true", label: "Да" }, { value: "false", label: "Нет" }]}
                    fullWidth
                  />
                </Stack>
              </>
            )}
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p={{ base: "md", sm: "lg" }}>
          <Stack gap="md">
            <Group justify="space-between" align="center"><Group gap="xs"><ThemeIcon color="indigo" variant="light" radius="md"><IconPhoto size={17} /></ThemeIcon><Text fw={700}>Фотографии</Text></Group><Badge variant="light" color={images.length ? "indigo" : "gray"}>{images.length}/12</Badge></Group>
            <Text size="sm" c="dimmed">Первая фотография используется как обложка. Допустимы JPG, PNG и WebP до 10 МБ.</Text>
            <FileInput accept="image/jpeg,image/png,image/webp" multiple clearable disabled={uploadingImages || images.length >= 12} placeholder="Добавить фотографии" onChange={uploadPhotos} leftSection={<IconPhoto size={16} />} />
            <ListingPhotoGrid images={images} uploading={uploadingImages} onRemove={removeImage} />
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p={{ base: "md", sm: "lg" }}>
          <Textarea label="Комментарий к изменению" value={form.reason} onChange={(event) => updateForm("reason", event.currentTarget.value)} maxLength={500} minRows={2} description="Необязательно. Комментарий будет виден модерации в истории изменений." />
        </Paper>

        <Group justify="space-between" wrap="wrap-reverse">
          <Button component={Link} href={detailHref} variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />}>Отменить</Button>
          <Button onClick={save} loading={saving} disabled={uploadingImages} color="indigo" leftSection={<IconCheck size={17} />}>Сохранить изменения</Button>
        </Group>
      </Stack>
    </Container>
  )
}
