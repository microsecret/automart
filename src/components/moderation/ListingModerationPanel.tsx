"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { notifications } from "@mantine/notifications"
import { Badge, Button, Card, Center, Group, Loader, Modal, Stack, Text, Textarea, ThemeIcon } from "@mantine/core"
import { IconArchive, IconCheck, IconFlame, IconTag, IconX } from "@tabler/icons-react"
import { LISTING_STATUS, LISTING_STATUS_META } from "@/lib/listing-lifecycle"

const fetcher = (url: string) => fetch(url).then((response) => response.json())

type ModerationConfirmation = {
  id: string
  kind: "reject" | "remove"
  title: string
}

/** A deliberately narrow moderation workspace. It uses the API as the source
 * of truth, so moderators never receive broader admin data in the browser. */
export default function ListingModerationPanel() {
  const { data, isLoading, mutate } = useSWR<any>("/api/admin/listings", fetcher)
  const listings = data?.listings || []
  const visibleListings = listings.filter((listing: any) => !listing.deletedAt)
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
      const response = await fetch("/api/admin/listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, reason: reason?.trim() || undefined }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось обновить статус")
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
      const response = await fetch(`/api/admin/listings?id=${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось снять объявление")
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
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Group gap="sm"><ThemeIcon variant="light" color="red" size={32} radius="md"><IconFlame size={18} /></ThemeIcon><Text fw={700} c="dark.9">Модерация объявлений</Text></Group>
          <Badge size="sm" variant="light" color="gray">{visibleListings.length}</Badge>
        </Group>
        {isLoading ? <Center py={20}><Loader size="sm" color="indigo" /></Center> : (
          visibleListings.length === 0 ? (
            <Center py="xl"><Stack align="center" gap={4}><ThemeIcon variant="light" color="green" size={42} radius="xl"><IconCheck size={22} /></ThemeIcon><Text fw={600}>Очередь разобрана</Text><Text size="sm" c="dimmed">Новые объявления появятся здесь после отправки на проверку.</Text></Stack></Center>
          ) : <Stack gap="xs" mah={520} style={{ overflow: "auto" }}>
            {visibleListings.slice(0, 50).map((listing: any) => {
              const statusMeta = LISTING_STATUS_META[listing.status as keyof typeof LISTING_STATUS_META] || LISTING_STATUS_META[LISTING_STATUS.DRAFT]
              const isPending = listing.status === LISTING_STATUS.PENDING_MODERATION
              const detailHref = listing.vehicle ? `/listings/vehicle/${listing.vehicle.id}` : `/listings/part/${listing.part?.id}`
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
                    <Button component={Link} href={detailHref} target="_blank" size="xs" variant="light" color="indigo">Открыть</Button>
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
