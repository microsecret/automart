"use client"
export const dynamic = "force-dynamic"
import useSWR from "swr"
import { ActionIcon, Alert, Box, Button, Group, Menu, Modal, Paper, Badge, Center, Loader, Stack, Text, Textarea, ThemeIcon, Select, SimpleGrid, Tooltip, Progress } from "@mantine/core"
import { IconCheck, IconClock, IconDatabase, IconDotsVertical, IconEdit, IconGavel, IconMail, IconMapPin, IconPhone } from "@tabler/icons-react"
import { formatRelativeDate } from "@/lib/format"
import { useState } from "react"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { isSafeMediaUrl } from "@/lib/media-url"

const fetcher = fetchJson

type AuctionInquiry = {
  id: string
  status: string
  phone: string
  name: string
  email?: string | null
  city?: string | null
  comment?: string | null
  managerNotes?: string | null
  createdAt: string
  auctionListing?: {
    imageUrl?: string | null
    make: string
    model: string
    year: number
    source: string
    finalPrice?: number | null
  } | null
}

type AuctionInquiryResponse = { inquiries: AuctionInquiry[] }
type AuctionInquiryUpdateResponse = { success: true; inquiry: AuctionInquiry }
type AuctionStatsResponse = {
  total: number
  visibleAuctions?: number
  totalAuctions?: number
  recent?: number
  lastAuctionSync?: string | null
  catalogHealth?: {
    source: string
    active: number
    freshWithin8Hours: number
    staleMoreThan8Hours: number
    pendingRemoval: number
    latestRun: {
      startedAt: string
      completedAt: string | null
      status: string
      syncKind: string
      failed: number
      expired: number
    } | null
  }
  byStatus?: Partial<Record<(typeof STATUSES)[number]["value"], number>>
}

const STATUSES = [
  { value: "NEW", label: "Новые", color: "red" },
  { value: "CONTACTED", label: "Связались", color: "orange" },
  { value: "IN_PROGRESS", label: "В работе", color: "blue" },
  { value: "CLOSED", label: "Закрыто", color: "gray" },
  { value: "SOLD", label: "Продано", color: "green" },
]

export default function AdminAuctionsPage() {
  const [status, setStatus] = useState("NEW")
  const [editingInquiry, setEditingInquiry] = useState<AuctionInquiry | null>(null)
  const [editingStatus, setEditingStatus] = useState("NEW")
  const [managerNotes, setManagerNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const { data, error, isLoading, mutate } = useSWR<AuctionInquiryResponse>(`/api/admin/auctions/inquiries${status ? `?status=${status}` : ""}`, fetcher)
  const { data: stats } = useSWR<AuctionStatsResponse>("/api/admin/auctions/stats", fetcher)
  const inquiries = data?.inquiries || []
  const catalogHealth = stats?.catalogHealth
  const freshnessPercent = catalogHealth?.active
    ? Math.round((catalogHealth.freshWithin8Hours / catalogHealth.active) * 100)
    : 0

  const openInquiryEditor = (inquiry: AuctionInquiry, nextStatus = inquiry.status) => {
    setEditingInquiry(inquiry)
    setEditingStatus(nextStatus)
    setManagerNotes(inquiry.managerNotes || "")
    setSaveError("")
  }

  const saveInquiry = async () => {
    if (!editingInquiry) return
    setIsSaving(true)
    setSaveError("")
    try {
      await fetchJson<AuctionInquiryUpdateResponse>("/api/admin/auctions/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingInquiry.id, status: editingStatus, managerNotes }),
      })
      setEditingInquiry(null)
      await mutate()
    } catch (updateError) {
      setSaveError(updateError instanceof Error ? updateError.message : "Не удалось сохранить изменения заявки.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="orange" size={44} radius="md"><IconGavel size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Заявки с аукционов</Text>
            <Text size="xs" c="gray.5">{inquiries.length} заявок</Text>
          </Stack>
        </Group>

        {/* Статистика */}
        {stats && (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 7 }} spacing="sm">
            {[
              { label: "Всего заявок", value: stats.total, color: "#4f46e5", bg: "#eef2ff" },
              { label: "Лотов в каталоге", value: stats.visibleAuctions ?? stats.totalAuctions ?? 0, color: "#c2410c", bg: "#fff7ed" },
              { label: "Новые", value: stats.byStatus?.NEW || 0, color: "#e11d48", bg: "#fff1f2" },
              { label: "Связались", value: stats.byStatus?.CONTACTED || 0, color: "#ea580c", bg: "#fff7ed" },
              { label: "В работе", value: stats.byStatus?.IN_PROGRESS || 0, color: "#2563eb", bg: "#eff6ff" },
              { label: "Продано", value: stats.byStatus?.SOLD || 0, color: "#059669", bg: "#ecfdf5" },
              { label: "За неделю", value: stats.recent || 0, color: "#7c3aed", bg: "#f5f3ff" },
            ].map((card) => (
              <Paper key={card.label} radius="md" p="sm" withBorder>
                <Group gap="sm" align="center">
                  <Box style={{ width: 36, height: 36, borderRadius: 8, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Text fw={800} fz="lg" c={card.color} lh={1}>{card.value}</Text>
                  </Box>
                  <Text size="xs" c="gray.5">{card.label}</Text>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        )}

        {stats && (
          <Paper radius="md" p="sm" withBorder bg={stats.visibleAuctions ? undefined : "orange.0"}>
            <Group gap="xs" wrap="nowrap">
              <ThemeIcon variant="light" color={stats.visibleAuctions ? "orange" : "red"} size="sm"><IconDatabase size={14} /></ThemeIcon>
              <Text size="xs" c="gray.6">
                {stats.lastAuctionSync ? `Последняя проверка источников: ${formatRelativeDate(stats.lastAuctionSync)}.` : "Синхронизация источников ещё не выполнялась."}
                {stats.visibleAuctions ? ` В публичной выдаче: ${stats.visibleAuctions} лотов.` : " Публичная выдача пуста: проверьте импорт и статусы лотов."}
              </Text>
            </Group>
          </Paper>
        )}

        {catalogHealth && (
          <Paper radius="md" p="md" withBorder>
            <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" color={catalogHealth.pendingRemoval ? "orange" : "teal"} size={38} radius="md"><IconDatabase size={18} /></ThemeIcon>
                <Stack gap={1}>
                  <Text size="sm" fw={750}>Здоровье каталога {catalogHealth.source}</Text>
                  <Text size="xs" c="dimmed">Проверка идёт последовательно: не создаёт параллельных запросов и не маскирует снятые лоты.</Text>
                </Stack>
              </Group>
              <Badge size="sm" variant="light" color={catalogHealth.pendingRemoval ? "orange" : "teal"}>
                {catalogHealth.pendingRemoval ? `На повторной проверке: ${catalogHealth.pendingRemoval}` : "Нет лотов к снятию"}
              </Badge>
            </Group>
            <Progress value={freshnessPercent} color={freshnessPercent >= 80 ? "teal" : "orange"} size="sm" radius="xl" mt="md" />
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mt="sm">
              <Stack gap={1}><Text size="lg" fw={800}>{catalogHealth.active}</Text><Text size="xs" c="dimmed">активных лотов</Text></Stack>
              <Stack gap={1}><Text size="lg" fw={800} c="teal.7">{catalogHealth.freshWithin8Hours}</Text><Text size="xs" c="dimmed">проверены ≤ 8 ч</Text></Stack>
              <Stack gap={1}><Text size="lg" fw={800} c={catalogHealth.staleMoreThan8Hours ? "orange.7" : "teal.7"}>{catalogHealth.staleMoreThan8Hours}</Text><Text size="xs" c="dimmed">ожидают плановой проверки</Text></Stack>
              <Stack gap={1}><Text size="lg" fw={800}>{catalogHealth.latestRun?.failed || 0}</Text><Text size="xs" c="dimmed">ошибок в последнем цикле</Text></Stack>
            </SimpleGrid>
            {catalogHealth.latestRun && <Text size="xs" c="dimmed" mt="sm">Последний цикл: {catalogHealth.latestRun.syncKind.toLowerCase()} · {catalogHealth.latestRun.status.toLowerCase()} · {formatRelativeDate(catalogHealth.latestRun.completedAt || catalogHealth.latestRun.startedAt)}.</Text>}
          </Paper>
        )}

        <Select
          label="Статус заявки"
          data={[{ value: "", label: "Все" }, ...STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
          value={status}
          onChange={(value) => setStatus(value || "")}
          size="sm"
          w={200}
        />

        {isLoading ? <Center py={60}><Loader size="sm" color="orange" /></Center> :
         error ? <AsyncErrorState title="Не удалось загрузить заявки" description="Проверьте соединение и повторите запрос." onRetry={() => void mutate()} /> :
         inquiries.length === 0 ? <Paper radius="md" p="xl" withBorder><Center><Text c="gray.5">Нет заявок</Text></Center></Paper> :
         <Stack gap="xs">
          {inquiries.map((inq) => {
            const v = inq.auctionListing
            const image = isSafeMediaUrl(v?.imageUrl) ? v.imageUrl : ""
            const statusCfg = STATUSES.find((s) => s.value === inq.status) || STATUSES[0]
            return (
              <Paper key={inq.id} radius="md" p="md" withBorder>
                <Group gap="md" align="flex-start" wrap="nowrap">
                  <Box style={{ width: 80, height: 60, borderRadius: 8, overflow: "hidden", background: "var(--mantine-color-gray-1)", flexShrink: 0, position: "relative" }}>
                    <VehicleFallback type="CAR" compact />
                    {image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={(event) => { event.currentTarget.style.display = "none" }} />
                    )}
                  </Box>
                  <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="sm" align="center">
                      <Text fw={700} fz="sm" c="dark.9">{v ? `${v.make} ${v.model} ${v.year}` : "Авто"}</Text>
                      <Badge size="xs" variant="light" color={statusCfg.color}>{statusCfg.label}</Badge>
                      {v && <Badge size="xs" variant="light" color="orange">{v.source}</Badge>}
                    </Group>
                    <Group gap="md">
                      <Group gap={4}><IconPhone size={13} color="#71717a" /><Text size="xs" fw={600} c="dark.9">{inq.phone}</Text></Group>
                      <Text size="xs" c="gray.5">{inq.name}</Text>
                      {inq.email && <Group gap={4}><IconMail size={13} color="#71717a" /><Text size="xs" c="gray.5">{inq.email}</Text></Group>}
                      {inq.city && <Group gap={4}><IconMapPin size={13} color="#71717a" /><Text size="xs" c="gray.5">{inq.city}</Text></Group>}
                    </Group>
                    {inq.comment && <Text size="xs" c="gray.6" fs="italic">«{inq.comment}»</Text>}
                    {inq.managerNotes && <Text size="xs" c="indigo.7">Заметка менеджера: {inq.managerNotes}</Text>}
                    <Group gap={4}>
                      <IconClock size={12} color="#a1a1aa" />
                      <Text size="10px" c="gray.4">{formatRelativeDate(inq.createdAt)}</Text>
                      {v && <Text size="10px" c="gray.4">· Цена: {(v.finalPrice || 0).toLocaleString("ru")}₽</Text>}
                    </Group>
                  </Stack>
                  <Stack gap={6} align="flex-end">
                    <Tooltip label="Открыть карточку обработки">
                      <Button size="xs" variant="light" color="indigo" leftSection={<IconEdit size={14} />} onClick={() => openInquiryEditor(inq)}>Обработать</Button>
                    </Tooltip>
                    <Menu position="bottom-end" shadow="md" width={210} withinPortal>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" aria-label="Действия с заявкой"><IconDotsVertical size={17} /></ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>Сменить статус</Menu.Label>
                        {STATUSES.filter((item) => item.value !== inq.status).map((item) => (
                          <Menu.Item key={item.value} leftSection={<IconCheck size={14} />} color={item.color} onClick={() => openInquiryEditor(inq, item.value)}>
                            {item.label}
                          </Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>
                  </Stack>
                </Group>
              </Paper>
            )
          })}
        </Stack>}
      </Stack>
      <Modal opened={Boolean(editingInquiry)} onClose={() => !isSaving && setEditingInquiry(null)} title="Обработка заявки" centered radius="lg">
        <Stack gap="sm">
          <Paper withBorder radius="md" p="sm" bg="gray.0">
            <Text size="sm" fw={700}>{editingInquiry?.auctionListing ? `${editingInquiry.auctionListing.make} ${editingInquiry.auctionListing.model} ${editingInquiry.auctionListing.year}` : "Заявка на автомобиль"}</Text>
            <Text size="xs" c="dimmed" mt={3}>{editingInquiry?.name} · {editingInquiry?.phone}</Text>
          </Paper>
          <Select
            label="Статус"
            data={STATUSES.map((item) => ({ value: item.value, label: item.label }))}
            value={editingStatus}
            onChange={(value) => setEditingStatus(value || "NEW")}
            allowDeselect={false}
          />
          <Textarea
            label="Заметка менеджера"
            description="Видна только сотрудникам в админ-панели."
            value={managerNotes}
            onChange={(event) => setManagerNotes(event.currentTarget.value)}
            maxLength={4000}
            minRows={4}
            autosize
          />
          {saveError && <Alert color="red" title="Изменения не сохранены">{saveError}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditingInquiry(null)} disabled={isSaving}>Отмена</Button>
            <Button color="indigo" leftSection={<IconCheck size={16} />} onClick={() => void saveInquiry()} loading={isSaving}>Сохранить</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
