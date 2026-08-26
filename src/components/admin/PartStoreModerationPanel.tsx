"use client"

import { useState } from "react"
import useSWR from "swr"
import { Alert, Badge, Box, Button, Card, Group, Loader, Modal, SegmentedControl, Stack, Text, Textarea, ThemeIcon } from "@mantine/core"
import { IconBuildingStore, IconCheck, IconExternalLink, IconX } from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { PART_STORE_STATUS, toneColor } from "@/lib/admin-status-tone"
import { fetchJson } from "@/lib/api-client"

type AdminStore = {
  id: string
  name: string
  slug: string
  city: string | null
  legalName: string | null
  inn: string | null
  contactPhone: string | null
  contactEmail: string | null
  status: string
  statusReason: string | null
  createdAt: string
  owner: { id: string; name: string | null; email: string | null }
  _count: { parts: number }
}

const STATUS_META: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.entries(PART_STORE_STATUS).map(([key, descriptor]) => [
    key,
    { label: descriptor.label, color: toneColor(descriptor.tone) },
  ]),
)

export default function PartStoreModerationPanel() {
  const [status, setStatus] = useState("PENDING")
  const { data, error, isLoading, mutate } = useSWR<{ stores: AdminStore[] }>(
    `/api/admin/stores?status=${status}`,
    fetchJson,
    { revalidateOnFocus: false },
  )
  const [suspendTarget, setSuspendTarget] = useState<AdminStore | null>(null)
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const changeStatus = async (store: AdminStore, nextStatus: string, statusReason?: string) => {
    setIsSaving(true)
    setActionError(null)
    try {
      const response = await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, statusReason }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setActionError(typeof payload?.error === "string" ? payload.error : "Не удалось изменить статус")
        return
      }
      setSuspendTarget(null)
      setReason("")
      await mutate()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
        <Group gap="sm">
          <ThemeIcon variant="light" color="violet" size={36} radius="md"><IconBuildingStore size={18} /></ThemeIcon>
          <Stack gap={1}>
            <Text size="sm" fw={700}>Магазины запчастей</Text>
            <Text size="xs" c="dimmed">Витрина становится публичной только после проверки реквизитов и каталога.</Text>
          </Stack>
        </Group>
        <SegmentedControl
          size="xs"
          value={status}
          onChange={setStatus}
          data={[
            { value: "PENDING", label: "На проверке" },
            { value: "ACTIVE", label: "Опубликованы" },
            { value: "SUSPENDED", label: "Приостановлены" },
          ]}
        />
      </Group>

      {actionError && <Alert color="red" variant="light" mb="sm">{actionError}</Alert>}

      {error ? (
        <AsyncErrorState title="Реестр недоступен" description="Не удалось загрузить магазины." onRetry={() => mutate()} />
      ) : isLoading ? (
        <Group justify="center" py="lg"><Loader size="sm" /></Group>
      ) : data?.stores.length ? (
        <Stack gap="sm">
          {data.stores.map((store) => {
            const meta = STATUS_META[store.status] || STATUS_META.DRAFT
            return (
              <Card key={store.id} withBorder radius="md" p="sm">
                <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs" wrap="wrap">
                      <Text fw={800}>{store.name}</Text>
                      <Badge size="sm" variant="light" color={meta.color}>{meta.label}</Badge>
                      <Badge size="sm" variant="outline" color="gray">{store._count.parts} позиций</Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mt={2}>
                      {store.legalName || "Юрлицо не указано"}{store.inn ? ` · ИНН ${store.inn}` : ""}{store.city ? ` · ${store.city}` : ""}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Владелец: {store.owner.name || store.owner.email || store.owner.id}
                      {store.contactPhone ? ` · ${store.contactPhone}` : ""}
                    </Text>
                    {store.statusReason && <Text size="xs" c="red.7" mt={4}>Причина: {store.statusReason}</Text>}
                  </Box>
                  <Group gap="xs" wrap="wrap">
                    <Button
                      component="a"
                      href={`/store/${store.slug}`}
                      target="_blank"
                      size="compact-sm"
                      variant="subtle"
                      color="gray"
                      leftSection={<IconExternalLink size={13} />}
                    >
                      Витрина
                    </Button>
                    {store.status !== "ACTIVE" && (
                      <Button size="compact-sm" color="teal" leftSection={<IconCheck size={14} />} onClick={() => changeStatus(store, "ACTIVE")} loading={isSaving}>
                        Опубликовать
                      </Button>
                    )}
                    {store.status !== "SUSPENDED" && (
                      <Button size="compact-sm" color="red" variant="light" leftSection={<IconX size={14} />} onClick={() => { setSuspendTarget(store); setReason("") }}>
                        Приостановить
                      </Button>
                    )}
                  </Group>
                </Group>
              </Card>
            )
          })}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          {status === "PENDING" ? "Заявок на проверку нет." : "В этом статусе магазинов нет."}
        </Text>
      )}

      <Modal opened={Boolean(suspendTarget)} onClose={() => setSuspendTarget(null)} title="Приостановить магазин" centered>
        <Stack gap="sm">
          <Text size="sm">
            Витрина «{suspendTarget?.name}» перестанет быть публичной. Причина видна владельцу в кабинете.
          </Text>
          <Textarea
            required
            label="Причина"
            placeholder="Например: реквизиты не совпадают с данными ФНС"
            autosize
            minRows={2}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
          />
          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setSuspendTarget(null)}>Отмена</Button>
            <Button
              color="red"
              disabled={reason.trim().length < 3}
              loading={isSaving}
              onClick={() => suspendTarget && changeStatus(suspendTarget, "SUSPENDED", reason.trim())}
            >
              Приостановить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}
