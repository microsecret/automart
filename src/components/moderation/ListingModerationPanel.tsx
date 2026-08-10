"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { notifications } from "@mantine/notifications"
import { Badge, Button, Card, Center, Group, Loader, Modal, SegmentedControl, Stack, Text, Textarea, ThemeIcon } from "@mantine/core"
import { IconAlertTriangle, IconArchive, IconCheck, IconFlame, IconTag, IconX } from "@tabler/icons-react"
import { isListingStatus, LISTING_STATUS, LISTING_STATUS_META, type ListingStatus } from "@/lib/listing-lifecycle"
import { fetchJson } from "@/lib/api-client"

type ModerationConfirmation = {
  id: string
  kind: "reject" | "remove"
  title: string
}

type ModerationListing = {
  id: string
  title: string
  price: number
  status: string
  deletedAt: string | null
  user: { id: string; name: string | null; email: string | null } | null
  vehicle: { id: string; make: string; model: string } | null
  part: { id: string; name: string } | null
}

type ModerationResponse = { listings: ModerationListing[] }
type ModerationMutationResponse = { id: string }

const fetchModerationQueue = (url: string) => fetchJson<ModerationResponse>(url)

/** A deliberately narrow moderation workspace. It uses the API as the source
 * of truth, so moderators never receive broader admin data in the browser. */
export default function ListingModerationPanel() {
  const { data, error, isLoading, mutate } = useSWR<ModerationResponse>("/api/admin/listings", fetchModerationQueue)
  const listings = data?.listings || []
  const visibleListings = listings.filter((listing) => !listing.deletedAt)
  const pendingListings = visibleListings.filter((listing) => listing.status === LISTING_STATUS.PENDING_MODERATION)
  const [view, setView] = useState<"pending" | "all">("pending")
  const displayedListings = view === "pending" ? pendingListings : visibleListings
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<ModerationConfirmation | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  const handleStatus = async (
    id: string,
    status: typeof LISTING_STATUS[keyof typeof LISTING_STATUS],
    reason?: string,
  ) => {
    if (status === LISTING_STATUS.REJECTED && !reason?.trim()) {
      notifications.show({ title: "Нужна причина", message: "Владелец должен понимать, что исправить перед повторной подачей.", color: "orange" })
      return
    }

    setUpdatingId(id)
    try {
      await fetchJson<ModerationMutationResponse>("/api/admin/listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, reason: reason?.trim() || undefined }),
      })
      notifications.show({ title: "Статус обновлён", message: "Решение сохранено в журнале модерации.", color: "green" })
      await mutate()
      setConfirmation(null)
      setRejectionReason("")
    } catch (error) {
      notifications.show({ title: "Ошибка модерации", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setUpdatingId(id)
    try {
      await fetchJson<ModerationMutationResponse>(`/api/admin/listings?id=${id}`, { method: "DELETE" })
      notifications.show({ title: "Снято с публикации", message: "Объявление сохранено в архиве", color: "green" })
      await mutate()
      setConfirmation(null)
    } catch (error) {
      notifications.show({ title: "Ошибка модерации", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Card className="admin-moderation-panel" withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Group gap="sm"><ThemeIcon variant="light" color="red" size={32} radius="md"><IconFlame size={18} /></ThemeIcon><Text fw={700} c="dark.9">Модерация объявлений</Text></Group>
          <Badge size="sm" variant="light" color={pendingListings.length > 0 ? "orange" : "green"}>{pendingListings.length} на проверке</Badge>
        </Group>
        <SegmentedControl
          size="xs"
          value={view}
          onChange={(value) => setView(value as "pending" | "all")}
          data={[
            { label: `На проверке (${pendingListings.length})`, value: "pending" },
            { label: `Все (${visibleListings.length})`, value: "all" },
          ]}
        />
        {isLoading ? <Center py={20}><Loader size="sm" color="indigo" /></Center> : error ? (
          <Center py="xl"><Stack align="center" gap="xs"><ThemeIcon variant="light" color="red" size={42} radius="xl"><IconAlertTriangle size={22} /></ThemeIcon><Text fw={600}>Не удалось загрузить очередь</Text><Text size="sm" c="dimmed" ta="center">Проверьте соединение и повторите попытку. Данные объявлений не изменены.</Text><Button size="xs" variant="light" color="indigo" onClick={() => void mutate()}>Повторить</Button></Stack></Center>
        ) : (
          displayedListings.length === 0 ? (
            <Center py="xl"><Stack align="center" gap={4}><ThemeIcon variant="light" color={view === "pending" ? "green" : "gray"} size={42} radius="xl"><IconCheck size={22} /></ThemeIcon><Text fw={600}>{view === "pending" ? "Очередь разобрана" : "Объявлений пока нет"}</Text><Text size="sm" c="dimmed">{view === "pending" ? "Новые объявления появятся здесь после отправки на проверку." : "Когда пользователи разместят объявления, они появятся в журнале модерации."}</Text></Stack></Center>
          ) : <Stack gap="xs" mah={520} style={{ overflow: "auto" }}>
            {displayedListings.slice(0, 50).map((listing) => {
              const status: ListingStatus = isListingStatus(listing.status) ? listing.status : LISTING_STATUS.DRAFT
              const statusMeta = LISTING_STATUS_META[status]
              const isPending = status === LISTING_STATUS.PENDING_MODERATION
              const detailHref = listing.vehicle
                ? `/listings/vehicle/${listing.vehicle.id}`
                : listing.part
                  ? `/listings/part/${listing.part.id}`
                  : null
              return (
                <Group key={listing.id} gap="sm" align="center" justify="space-between" p="xs" className="moderation-listing-row">
                  <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                    <IconTag size={16} color="#71717a" />
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} c="dark.9" className="line-clamp-1">{listing.title}</Text>
                      <Group gap={6} wrap="wrap"><Text size="xs" c="gray.5">{listing.user?.name || listing.user?.email} · {listing.vehicle ? `${listing.vehicle.make} ${listing.vehicle.model}` : listing.part?.name}</Text><Badge size="xs" color={statusMeta.color} variant="light">{statusMeta.label}</Badge></Group>
                    </Stack>
                  </Group>
                  <Group gap="xs" wrap="wrap" justify="flex-end">
                    <Text size="xs" fw={700} c="dark.9">{(listing.price || 0).toLocaleString("ru")} ₽</Text>
                    {detailHref && <Button component={Link} href={detailHref} target="_blank" size="xs" variant="light" color="indigo">Открыть</Button>}
                    {isPending && <Button size="xs" variant="light" color="green" loading={updatingId === listing.id} onClick={() => handleStatus(listing.id, LISTING_STATUS.ACTIVE)} leftSection={<IconCheck size={12} />}>Одобрить</Button>}
                    {isPending && <Button size="xs" variant="light" color="red" loading={updatingId === listing.id} onClick={() => { setRejectionReason(""); setConfirmation({ id: listing.id, kind: "reject", title: listing.title }) }} leftSection={<IconX size={12} />}>Отклонить</Button>}
                    {!isPending && listing.status !== LISTING_STATUS.ARCHIVED && <Button size="xs" variant="subtle" color="gray" loading={updatingId === listing.id} onClick={() => handleStatus(listing.id, LISTING_STATUS.ARCHIVED)} leftSection={<IconArchive size={12} />}>В архив</Button>}
                    <Button size="xs" variant="subtle" color="red" loading={updatingId === listing.id} onClick={() => setConfirmation({ id: listing.id, kind: "remove", title: listing.title })}>Снять</Button>
                  </Group>
                </Group>
              )
            })}
          </Stack>
        )}
      </Stack>
      <Modal
        opened={Boolean(confirmation)}
        onClose={() => { setConfirmation(null); setRejectionReason("") }}
        title={confirmation?.kind === "reject" ? "Отклонить объявление" : "Снять объявление"}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {confirmation?.kind === "reject"
              ? `Сообщите владельцу, что исправить в объявлении «${confirmation?.title}».`
              : `Объявление «${confirmation?.title}» исчезнет из публичной выдачи, но останется в журнале модерации.`}
          </Text>
          {confirmation?.kind === "reject" && (
            <Textarea
              label="Причина отклонения"
              placeholder="Например: добавьте реальное фото и укажите VIN в описании"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.currentTarget.value)}
              autosize
              minRows={3}
              required
              autoFocus
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setConfirmation(null); setRejectionReason("") }}>Отмена</Button>
            <Button
              color="red"
              loading={updatingId === confirmation?.id}
              onClick={() => {
                if (!confirmation) return
                if (confirmation.kind === "reject") {
                  void handleStatus(confirmation.id, LISTING_STATUS.REJECTED, rejectionReason)
                } else {
                  void handleDelete(confirmation.id)
                }
              }}
            >
              {confirmation?.kind === "reject" ? "Отклонить" : "Снять с публикации"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}
