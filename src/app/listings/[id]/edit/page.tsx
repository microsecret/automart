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
  Skeleton,
  Stack,
  Text,
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

type EditableSubject = { id: string; location: string; images: string | null }
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
type FormState = { title: string; description: string; price: string; location: string; reason: string }
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
    setForm({
      title: data.listing.title,
      description: data.listing.description || "",
      price: String(data.listing.price),
      location: subject.location,
      reason: "",
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
  const detailHref = subject ? `/listings/${isVehicle ? "vehicle" : "part"}/${subject.id}` : "/dashboard"
  const statusMeta = LISTING_STATUS_META[data.listing.status] || LISTING_STATUS_META.DRAFT

  const updateForm = (key: keyof FormState, value: string) => setForm((current) => current ? { ...current, [key]: value } : current)
  const save = async () => {
    const price = Number(form.price)
    if (!form.title.trim() || !Number.isSafeInteger(price) || price < 0 || !form.location.trim()) {
      notifications.show({ title: "Проверьте поля", message: "Укажите заголовок, целую цену и город.", color: "red" })
      return
    }
    setSaving(true)
    try {
      const payload = await fetchJson<UpdateListingResponse>(`/api/listings/${data.listing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, description: form.description, price, location: form.location, images, reason: form.reason }),
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
              <Text component="h1" fw={800} fz={{ base: 22, sm: 26 }}>Редактирование объявления</Text>
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

        <Paper withBorder radius="md" p={{ base: "md", sm: "lg" }}>
          <Stack gap="md">
            <Text fw={750}>Основные данные</Text>
            <TextInput label="Заголовок" required value={form.title} onChange={(event) => updateForm("title", event.currentTarget.value)} maxLength={200} />
            <Group grow align="flex-start">
              <TextInput label="Цена, ₽" required inputMode="numeric" value={form.price} onChange={(event) => updateForm("price", event.currentTarget.value.replace(/\D/g, ""))} />
              <TextInput label="Город" required value={form.location} onChange={(event) => updateForm("location", event.currentTarget.value)} maxLength={120} />
            </Group>
            <Textarea label="Описание" value={form.description} onChange={(event) => updateForm("description", event.currentTarget.value)} minRows={5} autosize maxLength={5000} description={`${form.description.length}/5000`} />
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p={{ base: "md", sm: "lg" }}>
          <Stack gap="md">
            <Group justify="space-between" align="center"><Group gap="xs"><ThemeIcon color="indigo" variant="light" radius="md"><IconPhoto size={17} /></ThemeIcon><Text fw={750}>Фотографии</Text></Group><Badge variant="light" color={images.length ? "indigo" : "gray"}>{images.length}/12</Badge></Group>
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
