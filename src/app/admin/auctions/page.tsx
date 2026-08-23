"use client"

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useState } from "react"
import useSWR from "swr"
import {
  Alert, Anchor, Badge, Box, Button, Center, Divider, Drawer, Group, Loader,
  NumberInput, Paper, Progress, Select, SimpleGrid, Stack, Text, Textarea,
  ThemeIcon, Title,
} from "@mantine/core"
import {
  IconArrowRight, IconBuildingStore, IconCheck, IconClock, IconDatabase,
  IconExternalLink, IconGavel, IconLock, IconMail, IconMapPin, IconPhone,
  IconReceipt, IconShieldCheck, IconUserCheck,
} from "@tabler/icons-react"
import { formatRelativeDate } from "@/lib/format"
import { formatQueueAge, hoursSince, queueUrgency } from "@/lib/queue-age"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { isSafeMediaUrl } from "@/lib/media-url"
import AuctionLotAdministration from "@/components/admin/AuctionLotAdministration"
import type { AuctionOperationalStatus } from "@/lib/auction-source-health"

type InquiryUser = { id: string; name: string | null }
type InquiryDeal = {
  id: string
  code: string
  status: string
  platformFeeStatus: string
  buyerDepositStatus: string
  _count?: { moderationEvents: number }
}

type AuctionInquiry = {
  id: string
  status: string
  phone: string
  name: string
  email?: string | null
  city?: string | null
  comment?: string | null
  managerNotes?: string | null
  requesterId?: string | null
  requester?: InquiryUser | null
  assignedPartnerId?: string | null
  assignedPartner?: InquiryUser | null
  assignedBy?: InquiryUser | null
  assignedAt?: string | null
  deliveryOrder?: InquiryDeal | null
  platformFeeAmount?: number | null
  buyerDepositAmount?: number | null
  offers?: Array<{ id: string; status: string; expiresAt: string; organization: { legalName: string } }>
  createdAt: string
  auctionListing?: {
    id: string
    imageUrl?: string | null
    make: string
    model: string
    year: number
    source: string
    country: string
    location?: string | null
    lotNumber?: string | null
    finalPrice?: number | null
  } | null
}

type VerifiedPartner = {
  organizationId: string
  organizationName: string
  serviceRegions: string | null
  userId: string
  userName: string | null
  assignedInquiries: number
}

type AuctionInquiryResponse = { inquiries: AuctionInquiry[]; partners: VerifiedPartner[] }
type AuctionInquiryUpdateResponse = { success: true; inquiry: { id: string; status: string; deliveryOrderId?: string | null } }

type AuctionStatsResponse = {
  total: number
  visibleAuctions?: number
  totalAuctions?: number
  recent?: number
  lastAuctionSync?: string | null
  sourceHealth?: Array<{
    source: string
    label: string
    country: string | null
    active: number
    fresh: number
    stale: number
    freshPercent: number | null
    pendingRemoval: number
    qualityHold: number
    expectedRefreshHours: number
    latestSeenAt: string | null
    latestRunAt: string | null
    operationalStatus: AuctionOperationalStatus
    consecutiveIssues: number
  }>
  byStatus?: Partial<Record<(typeof STATUSES)[number]["value"], number>>
}

const STATUSES = [
  { value: "NEW", label: "Новые", color: "red" },
  { value: "CONTACTED", label: "Уточнение", color: "orange" },
  { value: "IN_PROGRESS", label: "В работе", color: "blue" },
  { value: "CLOSED", label: "Закрыто", color: "gray" },
  { value: "SOLD", label: "Выкуплено", color: "teal" },
] as const

const INITIAL_PLATFORM_FEE = 30_000
const INITIAL_DEPOSIT = 100_000

export default function AdminAuctionsPage() {
  const [status, setStatus] = useState("NEW")
  const [editingInquiry, setEditingInquiry] = useState<AuctionInquiry | null>(null)
  const [editingStatus, setEditingStatus] = useState("NEW")
  const [managerNotes, setManagerNotes] = useState("")
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null)
  const [platformFeeAmount, setPlatformFeeAmount] = useState<number | string>(INITIAL_PLATFORM_FEE)
  const [buyerDepositAmount, setBuyerDepositAmount] = useState<number | string>(INITIAL_DEPOSIT)
  const [isSaving, setIsSaving] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [saveError, setSaveError] = useState("")

  const { data, error, isLoading, mutate } = useSWR<AuctionInquiryResponse>(
    `/api/admin/auctions/inquiries${status ? `?status=${status}` : ""}`,
    fetchJson,
  )
  const { data: stats } = useSWR<AuctionStatsResponse>("/api/admin/auctions/stats", fetchJson)
  const inquiries = data?.inquiries || []
  const partners = data?.partners || []
  const sourceHealth = stats?.sourceHealth || []
  const catalogTotals = sourceHealth.reduce((totals, source) => ({
    active: totals.active + source.active,
    fresh: totals.fresh + source.fresh,
    stale: totals.stale + source.stale,
    pendingRemoval: totals.pendingRemoval + source.pendingRemoval,
    qualityHold: totals.qualityHold + source.qualityHold,
  }), { active: 0, fresh: 0, stale: 0, pendingRemoval: 0, qualityHold: 0 })
  const freshnessPercent = catalogTotals.active ? Math.round((catalogTotals.fresh / catalogTotals.active) * 100) : 0
  const parserAlerts = sourceHealth.filter((source) => ["DEGRADED", "FAILED", "STUCK", "NOT_RUN"].includes(source.operationalStatus))

  const openInquiryEditor = (inquiry: AuctionInquiry) => {
    setEditingInquiry(inquiry)
    setEditingStatus(inquiry.status)
    setManagerNotes(inquiry.managerNotes || "")
    setSelectedPartnerId(inquiry.assignedPartnerId || null)
    setPlatformFeeAmount(inquiry.platformFeeAmount || INITIAL_PLATFORM_FEE)
    setBuyerDepositAmount(inquiry.buyerDepositAmount || INITIAL_DEPOSIT)
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

  const assignInquiry = async () => {
    if (!editingInquiry || !selectedPartnerId) return
    setIsAssigning(true)
    setSaveError("")
    try {
      await fetchJson<AuctionInquiryUpdateResponse>("/api/admin/auctions/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ASSIGN",
          id: editingInquiry.id,
          partnerId: selectedPartnerId,
          platformFeeAmount: Number(platformFeeAmount),
          buyerDepositAmount: Number(buyerDepositAmount),
        }),
      })
      setEditingInquiry(null)
      await mutate()
    } catch (assignmentError) {
      setSaveError(assignmentError instanceof Error ? assignmentError.message : "Не удалось назначить партнёра.")
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Box p={{ base: "sm", md: "lg" }}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Group gap="sm" align="center" wrap="nowrap">
            <ThemeIcon variant="light" color="orange" size={48} radius="lg"><IconGavel size={24} /></ThemeIcon>
            <Stack gap={1}>
              <Title order={1} fz={{ base: 24, md: 30 }} ff="var(--font-display),sans-serif">Заявки с аукционов</Title>
              <Text size="sm" c="dimmed">Назначение партнёра, защищённая сделка и контроль оплаты</Text>
            </Stack>
          </Group>
          <Badge variant="light" color="teal" size="lg" leftSection={<IconShieldCheck size={14} />}>Контакты видит только администратор</Badge>
        </Group>

        {stats && (
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
            {[
              { label: "Всего заявок", value: stats.total, color: "indigo" },
              { label: "Лотов в каталоге", value: stats.visibleAuctions ?? stats.totalAuctions ?? 0, color: "orange" },
              { label: "Новые", value: stats.byStatus?.NEW || 0, color: "red" },
              { label: "В работе", value: stats.byStatus?.IN_PROGRESS || 0, color: "blue" },
              { label: "Выкуплено", value: stats.byStatus?.SOLD || 0, color: "teal" },
              { label: "За неделю", value: stats.recent || 0, color: "violet" },
            ].map((card) => (
              <Paper key={card.label} radius="md" p="sm" withBorder>
                <Text fw={800} fz="xl" c={`${card.color}.7`} style={{ fontVariantNumeric: "tabular-nums" }}>{card.value}</Text>
                <Text size="xs" c="dimmed" mt={2}>{card.label}</Text>
              </Paper>
            ))}
          </SimpleGrid>
        )}

        {sourceHealth.length > 0 && (
          <Paper radius="md" p="md" withBorder>
            <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" color={catalogTotals.stale || catalogTotals.pendingRemoval || parserAlerts.length ? "orange" : "teal"} size={40} radius="md"><IconDatabase size={19} /></ThemeIcon>
                <Stack gap={1}>
                  <Text size="sm" fw={800}>Каталог всех аукционных источников</Text>
                  <Text size="xs" c="dimmed">
                    {catalogTotals.fresh.toLocaleString("ru-RU")} из {catalogTotals.active.toLocaleString("ru-RU")} активных лотов обновлены в норматив своей площадки
                  </Text>
                </Stack>
              </Group>
              <Group gap="xs" wrap="wrap">
                {catalogTotals.stale > 0 && <Badge variant="light" color="orange">Устарели: {catalogTotals.stale}</Badge>}
                {catalogTotals.pendingRemoval > 0 && <Badge variant="light" color="red">Проверка снятия: {catalogTotals.pendingRemoval}</Badge>}
                {catalogTotals.qualityHold > 0 && <Badge variant="light" color="grape">Карантин: {catalogTotals.qualityHold}</Badge>}
                {parserAlerts.length > 0 && <Badge variant="light" color="red">Сбои парсеров: {parserAlerts.length}</Badge>}
                {!catalogTotals.stale && !catalogTotals.pendingRemoval && !parserAlerts.length && <Badge variant="light" color="teal">Каталог актуален</Badge>}
                <Button component={Link} href="/admin" size="xs" variant="subtle" color="indigo">Диагностика</Button>
              </Group>
            </Group>
            <Progress value={freshnessPercent} color={freshnessPercent >= 80 ? "teal" : freshnessPercent >= 50 ? "yellow" : "red"} size="sm" radius="xl" mt="md" />
          </Paper>
        )}

        <AuctionLotAdministration />

        <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
          <Stack gap={1}>
            <Text fw={800}>Очередь обработки</Text>
            <Text size="xs" c="dimmed">В списке контакты намеренно скрыты. Откройте карточку, чтобы назначить ответственного.</Text>
          </Stack>
          <Select aria-label="Фильтр заявок по статусу" data={[{ value: "", label: "Все статусы" }, ...STATUSES.map((item) => ({ value: item.value, label: item.label }))]} value={status} onChange={(value) => setStatus(value || "")} w={{ base: "100%", sm: 210 }} />
        </Group>

        {isLoading ? <Center py={80}><Loader size="sm" color="orange" /></Center> :
          error ? <AsyncErrorState title="Не удалось загрузить заявки" description="Проверьте соединение и повторите запрос." onRetry={() => void mutate()} /> :
            inquiries.length === 0 ? (
              <Paper radius="md" p="xl" withBorder><Center><Stack align="center" gap="xs"><ThemeIcon variant="light" color="gray" size={46} radius="xl"><IconGavel size={22} /></ThemeIcon><Text fw={700}>В этом статусе заявок нет</Text><Text size="sm" c="dimmed">Новые обращения появятся здесь автоматически.</Text></Stack></Center></Paper>
            ) : (
              <Stack gap="sm">{inquiries.map((inquiry) => <InquiryRow key={inquiry.id} inquiry={inquiry} onOpen={() => openInquiryEditor(inquiry)} />)}</Stack>
            )}
      </Stack>

      <Drawer opened={Boolean(editingInquiry)} onClose={() => !isSaving && !isAssigning && setEditingInquiry(null)} title="Маршрут заявки" position="right" size="lg" padding="lg">
        {editingInquiry && (
          <Stack gap="lg">
            <Paper withBorder radius="md" p="md" bg="gray.0">
              <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Text fw={800} lineClamp={2}>{vehicleTitle(editingInquiry)}</Text>
                  <Group gap="xs" wrap="wrap">
                    {editingInquiry.auctionListing?.lotNumber && <Badge variant="light" color="orange">Лот {editingInquiry.auctionListing.lotNumber}</Badge>}
                    <Badge variant="light" color="gray">{editingInquiry.auctionListing?.source || "Источник"}</Badge>
                  </Group>
                </Stack>
                <Text fw={800} c="indigo.7" style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{formatRub(editingInquiry.auctionListing?.finalPrice)}</Text>
              </Group>
            </Paper>

            <Alert color="indigo" variant="light" icon={<IconLock size={18} />} title="Закрытые данные покупателя">
              <Stack gap={6} mt={4}>
                <Group gap="xs"><IconUserCheck size={15} /><Text size="sm" fw={700}>{editingInquiry.name}</Text>{editingInquiry.city && <Text size="sm" c="dimmed">· {editingInquiry.city}</Text>}</Group>
                <Group gap="xs"><IconPhone size={15} /><Text size="sm">{editingInquiry.phone}</Text></Group>
                {editingInquiry.email && <Group gap="xs"><IconMail size={15} /><Text size="sm">{editingInquiry.email}</Text></Group>}
                <Text size="xs" c="dimmed">Партнёру передаются только имя и город. Телефон и почта не входят в API сделки.</Text>
              </Stack>
            </Alert>

            {editingInquiry.comment && <Stack gap={4}><Text size="sm" fw={700}>Запрос покупателя</Text><Paper withBorder radius="md" p="sm"><Text size="sm" style={{ overflowWrap: "anywhere" }}>{editingInquiry.comment}</Text></Paper></Stack>}

            {editingInquiry.deliveryOrder ? (
              <Paper withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Group justify="space-between" gap="md" wrap="wrap">
                    <Group gap="sm"><ThemeIcon variant="light" color="teal" radius="md"><IconShieldCheck size={17} /></ThemeIcon><Stack gap={0}><Text fw={800}>Сделка {editingInquiry.deliveryOrder.code}</Text><Text size="xs" c="dimmed">Партнёр: {editingInquiry.assignedPartner?.name || "назначен"}</Text></Stack></Group>
                    <Button component={Link} href={`/dashboard/deliveries/${editingInquiry.deliveryOrder.id}`} variant="light" color="teal" rightSection={<IconExternalLink size={15} />}>Открыть сделку</Button>
                  </Group>
                  <Group gap="xs" wrap="wrap">
                    {editingInquiry.assignedBy && <Badge variant="light" color="gray">Назначил: {editingInquiry.assignedBy.name || "администратор"}</Badge>}
                    <Badge variant="light" color={editingInquiry.deliveryOrder._count?.moderationEvents ? "orange" : "teal"}>
                      Заблокировано контактов: {editingInquiry.deliveryOrder._count?.moderationEvents || 0}
                    </Badge>
                  </Group>
                </Stack>
              </Paper>
            ) : (
              <Stack gap="sm">
                <Divider label="Назначение партнёра" labelPosition="left" />
                {!editingInquiry.requesterId && <Alert color="orange" title="Нет связанного аккаунта">Это старая гостевая заявка. Защищённую сделку можно открыть только после новой заявки авторизованного покупателя.</Alert>}
                {partners.length === 0 ? (
                  <Alert color="orange" title="Нет проверенных партнёров">Сначала подтвердите организацию в <Anchor component={Link} href="/admin/delivery-organizations">реестре партнёров</Anchor>.</Alert>
                ) : (
                  <Select required searchable label="Проверенный партнёр" description="В списке только организации со статусом VERIFIED." placeholder="Выберите исполнителя" data={partners.map((partner) => ({ value: partner.userId, label: `${partner.organizationName} · в работе ${partner.assignedInquiries}` }))} value={selectedPartnerId} onChange={setSelectedPartnerId} />
                )}
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <NumberInput label="Задаток покупателя" description="Отдельный счёт после договора" min={10_000} max={5_000_000} step={10_000} thousandSeparator=" " suffix=" ₽" value={buyerDepositAmount} onChange={setBuyerDepositAmount} />
                  <NumberInput label="Сервисный сбор LeWheel" description="Доход площадки при старте сделки" min={1_000} max={1_000_000} step={5_000} thousandSeparator=" " suffix=" ₽" value={platformFeeAmount} onChange={setPlatformFeeAmount} />
                </SimpleGrid>
                <Paper withBorder radius="md" p="sm"><Group gap="sm" wrap="nowrap"><ThemeIcon variant="light" color="violet" radius="md"><IconReceipt size={17} /></ThemeIcon><Text size="xs" c="dimmed">Модель запуска: комиссия с реальной сделки. Задаток и вознаграждение площадки учитываются раздельно; счёт появляется только после согласования условий.</Text></Group></Paper>
                <Button color="indigo" size="md" leftSection={<IconBuildingStore size={18} />} rightSection={<IconArrowRight size={17} />} disabled={!editingInquiry.requesterId || !selectedPartnerId || partners.length === 0} loading={isAssigning} onClick={() => void assignInquiry()}>Назначить и открыть сделку</Button>
              </Stack>
            )}

            <Divider label="Внутренняя обработка" labelPosition="left" />
            <Select label="Статус заявки" data={STATUSES.map((item) => ({ value: item.value, label: item.label }))} value={editingStatus} onChange={(value) => setEditingStatus(value || "NEW")} allowDeselect={false} />
            <Textarea label="Заметка менеджера" description="Видна только сотрудникам в админ-панели." value={managerNotes} onChange={(event) => setManagerNotes(event.currentTarget.value)} maxLength={4000} minRows={4} autosize />
            {saveError && <Alert color="red" title="Действие не выполнено">{saveError}</Alert>}
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditingInquiry(null)} disabled={isSaving || isAssigning}>Закрыть</Button><Button color="indigo" leftSection={<IconCheck size={16} />} onClick={() => void saveInquiry()} loading={isSaving}>Сохранить статус</Button></Group>
          </Stack>
        )}
      </Drawer>
    </Box>
  )
}

function InquiryRow({ inquiry, onOpen }: { inquiry: AuctionInquiry; onOpen: () => void }) {
  const listing = inquiry.auctionListing
  const image = isSafeMediaUrl(listing?.imageUrl) ? listing?.imageUrl : ""
  const statusMeta = STATUSES.find((item) => item.value === inquiry.status) || STATUSES[0]

  return (
    <Paper radius="md" p="md" withBorder className="admin-auction-inquiry-row">
      <Group gap="md" align="flex-start" wrap="wrap">
        <Box className="admin-auction-inquiry-row__image">
          <VehicleFallback type="CAR" compact />
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={vehicleTitle(inquiry)} onError={(event) => { event.currentTarget.style.display = "none" }} />
          )}
        </Box>
        <Stack gap={6} style={{ flex: "1 1 380px", minWidth: 0 }}>
          <Group gap="xs" wrap="wrap"><Text fw={800} lineClamp={1}>{vehicleTitle(inquiry)}</Text><Badge size="xs" variant="light" color={statusMeta.color}>{statusMeta.label}</Badge>{listing && <Badge size="xs" variant="light" color="orange">{listing.source}</Badge>}</Group>
          <Group gap="md" wrap="wrap"><Group gap={5}><IconUserCheck size={14} color="#64748b" /><Text size="sm" fw={700}>{inquiry.name}</Text></Group>{inquiry.city && <Group gap={5}><IconMapPin size={14} color="#64748b" /><Text size="sm" c="dimmed">{inquiry.city}</Text></Group>}<Badge size="xs" variant="light" color={inquiry.requesterId ? "teal" : "orange"}>{inquiry.requesterId ? "Аккаунт подтверждён" : "Гостевая заявка"}</Badge></Group>
          {inquiry.comment && <Text size="sm" c="dimmed" lineClamp={2} style={{ overflowWrap: "anywhere" }}>{inquiry.comment}</Text>}
          <Group gap="xs" wrap="wrap">{(() => {
            /* Возраст необработанной заявки заметен, а не спрятан в серой
               подписи. Заявка на импорт это живой человек с деньгами: сутки
               без ответа уже плохо, трое суток — почти потерянный клиент.

               У закрытых и проданных возраст не подсвечиваем: там ждать
               уже нечего. */
            const waiting = inquiry.status === "NEW" || inquiry.status === "CONTACTED"
            const hours = waiting ? hoursSince(inquiry.createdAt) : null
            const urgency = queueUrgency(hours)
            if (waiting && hours !== null && urgency !== "fresh") {
              return (
                <Badge size="xs" variant="light" color={urgency === "critical" ? "red" : "orange"}>
                  без ответа {formatQueueAge(hours)}
                </Badge>
              )
            }
            return <Text size="xs" c="dimmed"><IconClock size={12} style={{ verticalAlign: -2 }} /> {formatRelativeDate(inquiry.createdAt)}</Text>
          })()}<Text size="xs" c="dimmed">· {formatRub(listing?.finalPrice)}</Text>{inquiry.offers?.length ? <Badge size="xs" variant="light" color={inquiry.assignedPartner ? "teal" : "indigo"}>Разослано партнёрам: {inquiry.offers.length}</Badge> : null}{inquiry.assignedPartner && <Text size="xs" c="indigo.7" fw={700}>· Партнёр: {inquiry.assignedPartner.name || "назначен"}</Text>}</Group>
        </Stack>
        <Stack gap={6} className="admin-auction-inquiry-row__actions"><Button variant={inquiry.deliveryOrder ? "light" : "filled"} color={inquiry.deliveryOrder ? "teal" : "indigo"} onClick={onOpen} rightSection={<IconArrowRight size={15} />}>{inquiry.deliveryOrder ? "Сделка открыта" : "Обработать"}</Button><Text size="xs" c="dimmed" ta="center">Контакты внутри</Text></Stack>
      </Group>
    </Paper>
  )
}

function vehicleTitle(inquiry: AuctionInquiry) {
  const listing = inquiry.auctionListing
  return listing ? `${listing.make} ${listing.model} ${listing.year}` : "Заявка на автомобиль"
}

function formatRub(value?: number | null) {
  return value && value > 0 ? `${value.toLocaleString("ru-RU")} ₽` : "Цена уточняется"
}
