"use client"
export const dynamic = "force-dynamic"


import useSWR from "swr"
import { ActionIcon, Alert, Box, Stack, Text, Center, Loader, SimpleGrid, Card, Paper, ThemeIcon, Title, Group, Badge, Progress, Button, Tooltip, Timeline, Tabs } from "@mantine/core"
import type { MantineColor } from "@mantine/core"
import { IconUsers, IconCar, IconTag, IconMessageCircle2, IconStar, IconBell, IconEye, IconFlame, IconTrendingUp, IconRobot, IconActivity, IconWorld, IconRefresh, IconDatabase, IconGavel, IconAlertTriangle, IconBuildingWarehouse, IconCheck, IconClock, IconListCheck, IconShieldCheck, IconCreditCard, IconCoins, IconReceipt, IconLockCheck, IconHeadset, IconBrandTelegram } from "@tabler/icons-react"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import ListingModerationPanel from "@/components/moderation/ListingModerationPanel"
import ListingReportModerationPanel from "@/components/moderation/ListingReportModerationPanel"
import AdminAuditLog from "@/components/admin/AdminAuditLog"
import PartStoreModerationPanel from "@/components/admin/PartStoreModerationPanel"
import ReferralPayoutPanel from "@/components/admin/ReferralPayoutPanel"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { compareByUrgency, formatQueueAge, queueUrgency } from "@/lib/queue-age"
import { fetchJson } from "@/lib/api-client"

type AdminStats = {
  counts: {
    users: number
    vehicles: number
    parts: number
    listings: number
    reviews: number
    messages: number
    notifications: number
    categories: number
    sessions: number
    aiLogs: number
    supportTickets: number
  }
  byVehicleType: Record<string, number>
  byRole: Record<string, number>
  recent: { newListings: number; newUsers: number }
  featured: number
  avgPrice: number
  traffic: {
    // Отрезки календарные и московские: day — с 00:00 МСК, week — с
    // понедельника, month — с первого числа месяца.
    periodLabels: { day: string; week: string; month: string }
    pageViewsDay: number
    pageViewsWeek: number
    pageViewsMonth: number
    uniqueVisitorsDay: number
    uniqueVisitorsWeek: number
    uniqueVisitorsMonth: number
    telegramMiniAppVisitorsDay: number
    telegramMiniAppVisitorsWeek: number
    pageViewsTrendWeek: number
    uniqueVisitorsTrendWeek: number
    pageViewsTrendMonth: number
    uniqueVisitorsTrendMonth: number
    returningVisitorsWeek: number
    newVisitorsWeek: number
    sessionsWeek: number
    bounceRateWeek: number
    authenticatedVisitorsWeek: number
    attributedRegistrationsWeek: number
    pagesPerVisitorWeek: number
    registrationConversionWeek: number
    daily: Array<{ date: string; pageViews: number; uniqueVisitors: number; registrations: number; newListings: number }>
    devices: Array<{ key: string; count: number }>
    sources: Array<{ key: string; count: number }>
    topPaths: Array<{ path: string; count: number }>
    recentVisitors: Array<{
      id: string
      href: string | null
      createdAt: string
      user: { id: string; name: string | null; email: string | null; telegramUsername: string | null } | null
    }>
  }
  listingPerformance: {
    statusCounts: Record<string, number>
    active: number
    pending: number
    sold: number
    publishedWeek: number
    soldWeek: number
    totalViews: number
    viewsWeek: number
    uniqueViewersWeek: number
    viewsTrendWeek: number
    favorites: number
    messageLeadsWeek: number
    leadConversionWeek: number
    daily: Array<{ date: string; views: number; uniqueViewers: number }>
    topListings: Array<{
      id: string
      href: string | null
      title: string
      status: string
      viewsWeek: number
      uniqueViewersWeek: number
      favorites: number
    }>
  }
  operations: {
    pendingListings: number
    openReports: number
    newAuctionInquiries: number
    activeAuctionInquiries: number
    pendingDeliveryOrganizations: number
    openSupportTickets: number
    waitingSupportTickets: number
    activeSupportTickets: number
    /** Оплаченное продвижение, которое не действует: деньги получены,
        услуга не оказана. */
    stuckPayments: number
    /** Возраст самой старой задачи в каждой очереди, часы. */
    oldest?: {
      pendingListings: number | null
      openReports: number | null
      newAuctionInquiries: number | null
      activeAuctionInquiries: number | null
      pendingDeliveryOrganizations: number | null
      waitingSupportTickets: number | null
      stuckPayments: number | null
    }
  }
  monetization: {
    provider: string
    paymentsConfigured: boolean
    safeDealConfigured: boolean
    confirmedRevenueRub: number
    paidOrders: number
    pendingOrders: number
    reviewRequiredOrders: number
    activePromotions: number
    byTariff: Array<{ tariffId: string; count: number; revenueRub: number }>
    recentOrders: Array<{
      id: string
      tariffId: string
      amountRub: number
      status: string
      provider: string
      createdAt: string
      paidAt: string | null
      listing: { id: string; title: string }
      user: { id: string; name: string | null; email: string | null }
    }>
  }
  auctionSyncRuns: Array<{
    id: string
    source: string
    syncKind: string
    status: string
    imported: number
    created: number
    updated: number
    failed: number
    skippedByPolicy: number
    excludedByPolicy: number
    startedAt: string
    error: string | null
  }>
  sourceCoverage: Array<{
    source: string
    label: string
    country: string | null
    pipeline: "PUBLIC_COLLECTOR" | "OFFICIAL_API" | "PARTNER_FEED"
    pipelineLabel: string
    configured: boolean
    lastStatus: string | null
    lastSyncAt: string | null
    runs24h: number
    failed24h: number
    partial24h: number
    successRate24h: number | null
  }>
  sourceFieldMatrix: Array<{
    source: string
    label: string
    total: number
    quarantined: number
    fields: Array<{ key: string; label: string; filled: number; percent: number | null }>
  }>
  sourceTransport: {
    configured: number
    active: number
    quarantined: number
    activeRequests: number
    completedRequests: number
    maxConnectionsPerProxy: number
    hardLimit: number
    configurationValid: boolean
  }
  partnerFeedConfigurationValid: boolean
}

const fetchAdminStats = (url: string) => fetchJson<AdminStats>(url)

type AdminMetric = {
  label: string
  value: number
  icon: ReactNode
  color: MantineColor
  href?: string
  new?: number
}

type AuctionAdminStats = {
  total: number
  visibleAuctions: number
  totalAuctions: number
  recent: number
  lastAuctionSync: string | null
  byStatus: { NEW: number; CONTACTED: number; IN_PROGRESS: number; CLOSED: number; SOLD: number }
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  CAR: "Легковые", MOTORCYCLE: "Мото", TRUCK: "Грузовики", SPECIAL: "Спецтехника", WATER: "Водный", AIR: "Авиа",
}

const DEVICE_LABELS: Record<string, string> = { DESKTOP: "Компьютеры", MOBILE: "Смартфоны", TABLET: "Планшеты", UNKNOWN: "Старые события" }
const SOURCE_LABELS: Record<string, string> = {
  DIRECT: "Прямые заходы", ORGANIC_SEARCH: "Поиск", SOCIAL: "Соцсети / Telegram",
  REFERRAL: "Другие сайты", INTERNAL: "Внутренние переходы", UNKNOWN: "Старые события",
}

const SCREEN_LABELS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/$/, "Главная страница"],
  [/^\/auctions\/[^/]+$/, "Карточка автомобиля с зарубежной площадки"],
  [/^\/auctions$/, "Каталог зарубежных автомобилей"],
  [/^\/category\/cars$/, "Легковые автомобили"],
  [/^\/category\/moto$/, "Мотоциклы"],
  [/^\/category\/trucks$/, "Грузовые автомобили"],
  [/^\/category\/special$/, "Спецтехника"],
  [/^\/category\/water$/, "Водный транспорт"],
  [/^\/category\/air$/, "Воздушный транспорт"],
  [/^\/listings\/vehicle\/[^/]+$/, "Карточка объявления об автомобиле"],
  [/^\/listings\/part\/[^/]+$/, "Карточка объявления о запчасти"],
  [/^\/parts-finder$/, "Каталог запчастей"],
  [/^\/news(?:\/[^/]+)?$/, "Новости"],
  [/^\/services\/fuel-map$/, "Карта автозаправок"],
  [/^\/services\/history-check$/, "Проверка истории автомобиля"],
  [/^\/services\/valuation$/, "Оценка стоимости"],
  [/^\/services\/smart-matching$/, "Умный подбор автомобиля"],
  [/^\/telegram$/, "Telegram Mini App"],
  [/^\/auth\/signin$/, "Вход в аккаунт"],
  [/^\/auth\/signup$/, "Регистрация"],
  [/^\/dashboard(?:\/.*)?$/, "Личный кабинет"],
  [/^\/admin(?:\/.*)?$/, "Панель администратора"],
]

function screenLabel(path: string) {
  const pathname = path.split("?")[0].replace(/\/$/, "") || "/"
  return SCREEN_LABELS.find(([pattern]) => pattern.test(pathname))?.[1] || "Другой раздел сайта"
}

type TrafficChartPoint = AdminStats["traffic"]["daily"][number]

function curvedLinePath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return ""
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const middleX = (previous.x + point.x) / 2
    return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`
  }, `M ${points[0].x} ${points[0].y}`)
}

function TrafficLineChart({ points }: { points: TrafficChartPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const width = 760
  const height = 210
  const padding = { top: 14, right: 18, bottom: 34, left: 42 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maximum = Math.max(1, ...points.flatMap((point) => [point.pageViews, point.uniqueVisitors, point.registrations, point.newListings]))
  const x = (index: number) => padding.left + (points.length > 1 ? (index / (points.length - 1)) * chartWidth : chartWidth / 2)
  const y = (value: number) => padding.top + chartHeight - (value / maximum) * chartHeight
  const pageViewPoints = points.map((point, index) => ({ x: x(index), y: y(point.pageViews) }))
  const visitorPoints = points.map((point, index) => ({ x: x(index), y: y(point.uniqueVisitors) }))
  const registrationPoints = points.map((point, index) => ({ x: x(index), y: y(point.registrations) }))
  const listingPoints = points.map((point, index) => ({ x: x(index), y: y(point.newListings) }))
  const pageViewPath = curvedLinePath(pageViewPoints)
  const visitorPath = curvedLinePath(visitorPoints)
  const registrationPath = curvedLinePath(registrationPoints)
  const listingPath = curvedLinePath(listingPoints)
  const areaPath = pageViewPoints.length ? `${pageViewPath} L ${pageViewPoints.at(-1)?.x} ${padding.top + chartHeight} L ${pageViewPoints[0].x} ${padding.top + chartHeight} Z` : ""
  const activePoint = activeIndex === null ? null : points[activeIndex]
  const activeX = activeIndex === null ? 0 : x(activeIndex)
  const interactionWidth = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth
  const tooltipPosition = activeIndex === 0
    ? { left: 8 }
    : activeIndex === points.length - 1
      ? { right: 8 }
      : { left: `${(activeX / width) * 100}%`, transform: "translateX(-50%)" }

  return (
    <Box className="admin-traffic-chart">
      <Box className="admin-traffic-chart__plot">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Интерактивный график просмотров, уникальных посетителей, регистраций и новых объявлений за семь дней" preserveAspectRatio="xMidYMid meet" onPointerLeave={() => setActiveIndex(null)}>
        <defs>
          <linearGradient id="admin-page-view-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b56b0" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#2b56b0" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const gridY = padding.top + chartHeight * ratio
          return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={gridY} y2={gridY} stroke="#e2e8f0" strokeWidth="1" />
        })}
        {areaPath && <path d={areaPath} fill="url(#admin-page-view-area)" />}
        {pageViewPath && <path d={pageViewPath} fill="none" stroke="#5b5cf0" strokeWidth="4" strokeLinecap="round" />}
        {visitorPath && <path d={visitorPath} fill="none" stroke="#16a3b6" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 5" />}
        {registrationPath && <path d={registrationPath} fill="none" stroke="#16a36a" strokeWidth="2.5" strokeLinecap="round" />}
        {listingPath && <path d={listingPath} fill="none" stroke="#1c4291" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 4" />}
        {activeIndex !== null && <line x1={activeX} x2={activeX} y1={padding.top} y2={padding.top + chartHeight} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />}
        {points.map((point, index) => {
          const label = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))
          const active = activeIndex === index
          return (
            <g key={point.date}>
              <circle cx={x(index)} cy={y(point.pageViews)} r={active ? 6 : 4} fill="#5b5cf0" stroke="white" strokeWidth="2" />
              <circle cx={x(index)} cy={y(point.uniqueVisitors)} r={active ? 5 : 3} fill="#16a3b6" stroke="white" strokeWidth="2" />
              {active && <circle cx={x(index)} cy={y(point.registrations)} r="4" fill="#16a36a" stroke="white" strokeWidth="2" />}
              {active && <circle cx={x(index)} cy={y(point.newListings)} r="4" fill="#1c4291" stroke="white" strokeWidth="2" />}
              <text x={x(index)} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="650">{label}</text>
              <rect
                x={Math.max(0, x(index) - interactionWidth / 2)}
                y="0"
                width={Math.min(interactionWidth, width - Math.max(0, x(index) - interactionWidth / 2))}
                height={height}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${label}: открыть показатели`}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerMove={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              />
            </g>
          )
        })}
        <text x="6" y={padding.top + 5} fill="#64748b" fontSize="11">{maximum}</text>
        <text x="28" y={padding.top + chartHeight + 4} fill="#94a3b8" fontSize="11">0</text>
      </svg>
      {activePoint && (
        <Paper className="admin-traffic-tooltip" withBorder shadow="lg" radius="md" p="sm" style={tooltipPosition}>
          <Text className="admin-traffic-tooltip__date" size="xs" fw={800} c="gray.6">
            📅 {new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${activePoint.date}T00:00:00Z`))}
          </Text>
          {[
            ["Просмотры страниц", activePoint.pageViews, "#5b5cf0"],
            ["Уникальные посетители", activePoint.uniqueVisitors, "#16a3b6"],
            ["Регистрации", activePoint.registrations, "#16a36a"],
            ["Новые объявления", activePoint.newListings, "#1c4291"],
          ].map(([label, value, color]) => (
            <Group key={String(label)} justify="space-between" gap="lg" wrap="nowrap" className="admin-traffic-tooltip__row">
              <Group gap={6} wrap="nowrap"><Box w={8} h={8} bg={String(color)} style={{ borderRadius: "50%", flex: "0 0 auto" }} /><Text size="xs" c="gray.6" style={{ whiteSpace: "nowrap" }}>{label}</Text></Group>
              <Text size="sm" fw={850} style={{ color: String(color), fontVariantNumeric: "tabular-nums" }}>{Number(value).toLocaleString("ru-RU")}</Text>
            </Group>
          ))}
        </Paper>
      )}
      </Box>
      <Group gap="md" justify="center" mt={4} wrap="wrap">
        <Badge variant="dot" color="indigo">Просмотры страниц</Badge>
        <Badge variant="dot" color="cyan">Уникальные посетители</Badge>
        <Badge variant="dot" color="teal">Регистрации</Badge>
        <Badge variant="dot" color="violet">Новые объявления</Badge>
      </Group>
    </Box>
  )
}

const SYNC_STATUS_META: Record<string, { label: string; color: MantineColor; icon: ReactNode }> = {
  SUCCEEDED: { label: "Завершён", color: "teal", icon: <IconCheck size={15} /> },
  PARTIAL: { label: "Частично", color: "orange", icon: <IconAlertTriangle size={15} /> },
  FAILED: { label: "Ошибка", color: "red", icon: <IconAlertTriangle size={15} /> },
  RUNNING: { label: "Выполняется", color: "blue", icon: <IconClock size={15} /> },
}

const PAYMENT_STATUS_META: Record<string, { label: string; color: MantineColor }> = {
  PENDING: { label: "Ожидает оплаты", color: "yellow" },
  PAID: { label: "Оплачен", color: "teal" },
  FAILED: { label: "Ошибка", color: "red" },
  CANCELED: { label: "Отменён", color: "gray" },
  REFUNDED: { label: "Возвращён", color: "blue" },
  REVIEW_REQUIRED: { label: "Нужна проверка", color: "orange" },
}

export default function AdminDashboard() {
  const { data, error, isLoading, mutate } = useSWR<AdminStats>("/api/admin/stats", fetchAdminStats)
  const { data: auctionStats, mutate: mutateAuctionStats } = useSWR<AuctionAdminStats>("/api/admin/auctions/stats", fetchJson)

  const refreshDashboard = async () => {
    await Promise.all([mutate(), mutateAuctionStats()])
  }

  if (isLoading) return <Center py={80}><Loader color="indigo" /></Center>
  if (error || !data) {
    return (
      <Box className="admin-workspace" p={{ base: "sm", md: "md" }}>
        <AsyncErrorState
          title="Не удалось загрузить админку"
          description="Статистика и очередь модерации не изменены. Повторите запрос, когда соединение восстановится."
          onRetry={() => void mutate()}
        />
      </Box>
    )
  }

  const c = data.counts
  const stats: AdminMetric[] = [
    { label: "Пользователи", value: c.users, icon: <IconUsers size={18} />, color: "indigo", href: "/admin/users", new: data.recent.newUsers },
    { label: "Объявления", value: c.listings, icon: <IconTag size={18} />, color: "blue", new: data.recent.newListings },
    { label: "Транспорт", value: c.vehicles, icon: <IconCar size={18} />, color: "teal" },
    { label: "Запчасти", value: c.parts, icon: <IconCar size={18} />, color: "green" },
    { label: "Сообщения", value: c.messages, icon: <IconMessageCircle2 size={18} />, color: "cyan" },
    { label: "Отзывы", value: c.reviews, icon: <IconStar size={18} />, color: "orange" },
    { label: "Уведомления", value: c.notifications, icon: <IconBell size={18} />, color: "red" },
    { label: "AI-запросы", value: c.aiLogs, icon: <IconRobot size={18} />, color: "violet" },
    { label: "Поддержка", value: c.supportTickets, icon: <IconHeadset size={18} />, color: "grape", href: "/admin/support" },
  ]

  const total = c.listings || 1
  const dailyTraffic = data.traffic.daily || []
  const maxDailyPageViews = Math.max(1, ...dailyTraffic.map((point) => point.pageViews))
  const dailyListingViews = data.listingPerformance.daily || []
  const maxDailyListingViews = Math.max(1, ...dailyListingViews.map((point) => point.views))
  /* Очередь задач с возрастом самой старой.

     Счётчик отвечает «сколько», возраст — «что горит». Три задачи возрастом
     двадцать минут и три, лежащие пятый день, выглядели одинаково, и по
     панели нельзя было понять, где затык. */
  const oldest = data.operations.oldest
  const operationItems = [
    { label: "Объявления на проверке", value: data.operations.pendingListings, oldestHours: oldest?.pendingListings ?? null, href: "/moderation", icon: <IconListCheck size={17} />, color: "orange" as MantineColor, description: "Проверить и принять решение" },
    { label: "Открытые жалобы", value: data.operations.openReports, oldestHours: oldest?.openReports ?? null, href: "/moderation", icon: <IconAlertTriangle size={17} />, color: "red" as MantineColor, description: "Разобрать обращения пользователей" },
    { label: "Новые заявки на импорт", value: data.operations.newAuctionInquiries, oldestHours: oldest?.newAuctionInquiries ?? null, href: "/admin/auctions", icon: <IconGavel size={17} />, color: "indigo" as MantineColor, description: "Связаться с клиентами" },
    { label: "Импорт в работе", value: data.operations.activeAuctionInquiries, oldestHours: oldest?.activeAuctionInquiries ?? null, href: "/admin/auctions", icon: <IconClock size={17} />, color: "blue" as MantineColor, description: "Проверить этап сделок" },
    { label: "Партнёры ждут проверки", value: data.operations.pendingDeliveryOrganizations, oldestHours: oldest?.pendingDeliveryOrganizations ?? null, href: "/admin/partners", icon: <IconBuildingWarehouse size={17} />, color: "violet" as MantineColor, description: "Проверить реквизиты в реестре" },
    { label: "Поддержка ждёт оператора", value: data.operations.waitingSupportTickets, oldestHours: oldest?.waitingSupportTickets ?? null, href: "/admin/support?status=WAITING_OPERATOR", icon: <IconHeadset size={17} />, color: "grape" as MantineColor, description: `${data.operations.openSupportTickets} открыто · ${data.operations.activeSupportTickets} в работе` },
    { label: "Оплачено, но не продвигается", value: data.operations.stuckPayments ?? 0, oldestHours: oldest?.stuckPayments ?? null, href: "/admin/users", icon: <IconCreditCard size={17} />, color: "red" as MantineColor, description: "Деньги получены, услуга не оказана" },
  ]
  const actionsTotal = operationItems.reduce((sum, item) => sum + item.value, 0)
  // Свежесть импорта — первое, что нужно знать при разборе очереди: устаревший
  // каталог объясняет и падение трафика, и жалобы на исчезнувшие лоты.
  const lastSyncLabel = (() => {
    const lastSyncAt = data.auctionSyncRuns[0]?.startedAt
    if (!lastSyncAt) return null
    const minutes = Math.round((Date.now() - new Date(lastSyncAt).getTime()) / 60_000)
    if (!Number.isFinite(minutes) || minutes < 0) return null
    if (minutes < 60) return `${minutes} мин назад`
    const hours = Math.round(minutes / 60)
    return hours < 24 ? `${hours} ч назад` : `${Math.round(hours / 24)} дн назад`
  })()

  return (
    <Box className="admin-workspace" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Card className="admin-workspace__hero" radius="md" p={{ base: "md", sm: "lg" }}>
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <Stack gap={5}>
              <Group gap={6}>
                <Badge variant="white" color="indigo" size="sm">ПАНЕЛЬ УПРАВЛЕНИЯ</Badge>
                {/* Статус отражает состояние очереди, а не факт того, что
                    страница открылась: «система онлайн» не несло информации. */}
                <Badge variant="dot" color={actionsTotal > 0 ? "orange" : "teal"} size="sm">
                  {actionsTotal > 0 ? `${actionsTotal} ждут решения` : "Очередь разобрана"}
                </Badge>
                {lastSyncLabel && <Badge variant="dot" color="gray" size="sm">Импорт: {lastSyncLabel}</Badge>}
              </Group>
              <Title order={2} size="h3" c="white" ff="var(--font-display),sans-serif">Администрирование Авторынка</Title>
              <Text size="sm" c="rgba(255,255,255,.74)">Пользователи, объявления и модерация — в одном рабочем пространстве.</Text>
            </Stack>
            <Group gap="xs">
              <Tooltip label="Обновить реальные показатели">
                <ActionIcon variant="white" color="dark" size="lg" aria-label="Обновить показатели" onClick={() => void refreshDashboard()}><IconRefresh size={17} /></ActionIcon>
              </Tooltip>
              <Button component={Link} href="/admin/users" variant="white" color="dark" size="sm">Пользователи</Button>
              <Button component={Link} href="/admin/auctions" variant="outline" color="gray" size="sm" styles={{ root: { color: "white", borderColor: "rgba(255,255,255,.48)" } }}>Заявки</Button>
              <Button component={Link} href="/admin/partners" variant="outline" color="gray" size="sm" styles={{ root: { color: "white", borderColor: "rgba(255,255,255,.48)" } }}>Партнёры</Button>
            </Group>
          </Group>
        </Card>

        {/* Панель открывается на том, что требует решения: если очередь не
            разобрана, статистика подождёт. При пустой очереди сразу виден
            обзор, а не пустой список задач. */}
        <Tabs defaultValue={actionsTotal > 0 ? "operations" : "overview"} variant="pills" color="indigo" keepMounted={false}>
          <Tabs.List mb="md" grow aria-label="Разделы панели администратора">
            <Tabs.Tab value="overview" leftSection={<IconTrendingUp size={16} />}>Обзор</Tabs.Tab>
            <Tabs.Tab value="operations" leftSection={<IconListCheck size={16} />}>Задачи <Badge size="xs" variant="filled" color={actionsTotal ? "orange" : "teal"}>{actionsTotal}</Badge></Tabs.Tab>
            <Tabs.Tab value="sources" leftSection={<IconDatabase size={16} />}>Импорт</Tabs.Tab>
            <Tabs.Tab value="monetization" leftSection={<IconCoins size={16} />}>Доход</Tabs.Tab>
            <Tabs.Tab value="moderation" leftSection={<IconShieldCheck size={16} />}>Модерация</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="operations">
            <Stack gap="md">

        {auctionStats && (
          <Card withBorder radius="md" p="md">
            <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" color="orange" size={40} radius="md"><IconDatabase size={19} /></ThemeIcon>
                <Stack gap={2}>
                  <Text size="sm" fw={700}>Импортный каталог и очередь</Text>
                  <Text size="xs" c="dimmed">
                    В поиске: {auctionStats.visibleAuctions} из {auctionStats.totalAuctions} актуальных лотов. {auctionStats.lastAuctionSync ? `Последняя синхронизация: ${new Date(auctionStats.lastAuctionSync).toLocaleString("ru-RU")}.` : "Синхронизация ещё не зафиксирована."}
                  </Text>
                </Stack>
              </Group>
              <Group gap="xs">
                <Badge variant="light" color="red">Новые: {auctionStats.byStatus.NEW}</Badge>
                <Badge variant="light" color="blue">В работе: {auctionStats.byStatus.IN_PROGRESS}</Badge>
                <Button component={Link} href="/admin/auctions" size="xs" variant="light" color="orange" leftSection={<IconGavel size={14} />}>Открыть очередь</Button>
              </Group>
            </Group>
          </Card>
        )}

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color={actionsTotal > 0 ? "orange" : "teal"} size={40} radius="md"><IconListCheck size={19} /></ThemeIcon>
              <Stack gap={1}>
                <Text size="sm" fw={750}>Оперативная очередь</Text>
                <Text size="xs" c="dimmed">Только реальные записи, требующие решения сотрудника.</Text>
              </Stack>
            </Group>
            <Badge variant="light" color={actionsTotal > 0 ? "orange" : "teal"} size="lg">{actionsTotal > 0 ? `${actionsTotal} требуют внимания` : "Очередь разобрана"}</Badge>
          </Group>
          {/* Непустые задачи идут первыми: разобранные направления не должны
              отодвигать то, что действительно ждёт решения. */}
          {/* Карточка строится из Paper, а не из Button: у кнопки с пустым
              значением leftSection отрывалась от сжавшегося текста, и в сетке
              оставались висящие иконки без подписи. */}
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs" mt="md">
            {/* Сортировка по возрасту, а не по величине счётчика.

                Раньше наверх попадало то, чего просто больше. Но один
                клиент, ждущий ответа неделю, важнее пяти объявлений,
                поданных час назад. */}
            {[...operationItems].sort(compareByUrgency).map((item) => (
              <Paper
                key={item.label}
                component={Link}
                href={item.href}
                className="admin-queue-card"
                data-idle={item.value === 0 || undefined}
                radius="md"
                p="sm"
                withBorder
              >
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <ThemeIcon variant="light" color={item.value ? item.color : "gray"} size={34} radius="md">{item.icon}</ThemeIcon>
                  <Box style={{ minWidth: 0 }}>
                    <Group gap={6} align="baseline">
                      <Text size="xl" fw={850} lh={1} c={item.value ? undefined : "dimmed"}>{item.value}</Text>
                      {item.value === 0 && <Text size="10px" c="dimmed">разобрано</Text>}
                    </Group>
                    <Text size="xs" fw={700} mt={2}>{item.label}</Text>
                    {/* Возраст самой старой задачи: подсветка растёт со
                        сроком ожидания — сутки требуют внимания, трое уже
                        просрочено. */}
                    {item.value > 0 && item.oldestHours !== null && (
                      <Badge
                        size="xs"
                        variant="light"
                        mt={3}
                        color={
                          queueUrgency(item.oldestHours) === "critical" ? "red"
                            : queueUrgency(item.oldestHours) === "warning" ? "orange"
                            : "gray"
                        }
                      >
                        ждёт {formatQueueAge(item.oldestHours)}
                      </Badge>
                    )}
                    <Text size="10px" c="dimmed" lineClamp={2} mt={2}>{item.description}</Text>
                  </Box>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        </Card>

            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="sources">
            <Stack gap="md">

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm" wrap="wrap">
            <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconDatabase size={18} /></ThemeIcon><Box><Text size="sm" fw={750}>Последние синхронизации источников</Text><Text size="xs" c="dimmed">Диагностика импорта без запуска парсера из интерфейса.</Text></Box></Group>
            <Button component={Link} href="/admin/auctions" size="xs" variant="light" color="indigo">Открыть заявки</Button>
          </Group>
          {data.auctionSyncRuns.length ? (
            <Timeline active={-1} bulletSize={24} lineWidth={2}>
              {data.auctionSyncRuns.map((run) => {
                const meta = SYNC_STATUS_META[run.status] || { label: run.status, color: "gray" as MantineColor, icon: <IconClock size={15} /> }
                const processed = run.imported || run.created || run.updated
                return (
                  <Timeline.Item key={run.id} bullet={<ThemeIcon size={24} radius="xl" color={meta.color} variant="light">{meta.icon}</ThemeIcon>} title={`${run.source} · ${run.syncKind}`}>
                    <Group gap="xs" mt={3} wrap="wrap"><Badge size="xs" variant="light" color={meta.color}>{meta.label}</Badge><Text size="xs" c="dimmed">{new Date(run.startedAt).toLocaleString("ru-RU")}</Text><Text size="xs" c="dimmed">Обработано: {processed}</Text>{run.failed > 0 && <Badge size="xs" color="red" variant="light">Ошибок: {run.failed}</Badge>}{run.excludedByPolicy + run.skippedByPolicy > 0 && <Badge size="xs" color="gray" variant="light">Исключено правилом: {run.excludedByPolicy + run.skippedByPolicy}</Badge>}</Group>
                    {run.error && <Text size="xs" c="red.7" mt={3} lineClamp={2}>{run.error}</Text>}
                  </Timeline.Item>
                )
              })}
            </Timeline>
          ) : <Text size="sm" c="dimmed">Запусков синхронизации ещё нет. После первого штатного запуска журнал появится здесь.</Text>}
        </Card>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
            <Group gap="sm">
              <ThemeIcon variant="light" color="grape" size={36} radius="md"><IconListCheck size={18} /></ThemeIcon>
              <Stack gap={1}>
                <Text size="sm" fw={750}>Полнота полей по источникам</Text>
                <Text size="xs" c="dimmed">Доля лотов с заполненным полем. Низкий процент — пробел в парсере либо поле, которого нет у площадки.</Text>
              </Stack>
            </Group>
            {data.sourceFieldMatrix.some((row) => row.quarantined > 0) && (
              <Badge variant="light" color="orange">
                В карантине качества: {data.sourceFieldMatrix.reduce((sum, row) => sum + row.quarantined, 0)}
              </Badge>
            )}
          </Group>
          {data.sourceFieldMatrix.length ? (
            <Stack gap="sm">
              {data.sourceFieldMatrix.map((row) => (
                <Paper key={row.source} withBorder radius="md" p="sm">
                  <Group justify="space-between" mb={8} wrap="wrap" gap="xs">
                    <Group gap="xs">
                      <Text size="sm" fw={700}>{row.label}</Text>
                      <Badge size="xs" variant="light" color="gray">{row.total.toLocaleString("ru-RU")} лотов</Badge>
                    </Group>
                    {row.quarantined > 0 && <Badge size="xs" variant="light" color="orange">Скрыто: {row.quarantined}</Badge>}
                  </Group>
                  <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="xs">
                    {row.fields.map((field) => (
                      <Box key={field.key}>
                        <Group justify="space-between" gap={4} wrap="nowrap">
                          <Text size="xs" c="dimmed" truncate>{field.label}</Text>
                          <Text size="xs" fw={700}>{field.percent === null ? "—" : `${field.percent}%`}</Text>
                        </Group>
                        <Progress
                          mt={3}
                          size="sm"
                          radius="xl"
                          value={field.percent ?? 0}
                          color={field.percent === null ? "gray" : field.percent >= 80 ? "teal" : field.percent >= 40 ? "yellow" : "red"}
                        />
                      </Box>
                    ))}
                  </SimpleGrid>
                </Paper>
              ))}
            </Stack>
          ) : <Text size="sm" c="dimmed">Аукционных лотов пока нет — матрица появится после первого импорта.</Text>}
        </Card>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
            <Group gap="sm">
              <ThemeIcon variant="light" color="cyan" size={36} radius="md"><IconWorld size={18} /></ThemeIcon>
              <Stack gap={1}>
                <Text size="sm" fw={750}>Реестр источников импорта</Text>
                <Text size="xs" c="dimmed">Статус отражает фактический способ получения данных, а не только доступность страны в фильтре.</Text>
              </Stack>
            </Group>
            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="teal">Подключено: {data.sourceCoverage.filter((source) => source.configured).length}/{data.sourceCoverage.length}</Badge>
              <Badge variant="light" color={data.sourceTransport.configurationValid ? "blue" : "red"}>
                Прокси: {data.sourceTransport.active}/{data.sourceTransport.configured} активны · занято {data.sourceTransport.activeRequests} · лимит {data.sourceTransport.maxConnectionsPerProxy}
              </Badge>
              {data.sourceTransport.quarantined > 0 && <Badge variant="light" color="orange">Карантин: {data.sourceTransport.quarantined}</Badge>}
            </Group>
          </Group>
          {!data.sourceTransport.configurationValid && (
            <Alert color="red" variant="light" mb="sm" title="Пул прокси настроен некорректно">
              Проверьте server env. Учётные данные намеренно не выводятся в интерфейс или журнал.
            </Alert>
          )}
          {!data.partnerFeedConfigurationValid && (
            <Alert color="red" variant="light" mb="sm" title="Конфигурация партнёрских feeds некорректна">
              Проверьте AUCTION_PARTNER_FEEDS_JSON. Токены и URL в интерфейсе не раскрываются.
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }} spacing="xs">
            {data.sourceCoverage.map((source) => {
              const isCollector = source.configured
              const statusMeta = source.lastStatus ? SYNC_STATUS_META[source.lastStatus] : null
              return (
                <Paper key={source.source} withBorder radius="md" p="sm">
                  <Group justify="space-between" gap="xs" wrap="nowrap">
                    <Text size="sm" fw={750} lineClamp={1}>{source.label}</Text>
                    <Badge size="xs" variant="light" color={isCollector ? "teal" : "gray"}>{source.country || "—"}</Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>{source.pipelineLabel}</Text>
                  <Group gap={5} mt="xs" wrap="wrap">
                    <Badge size="xs" variant="dot" color={isCollector ? "teal" : "gray"}>{isCollector ? "Источник подключён" : "Нужен доступ / feed"}</Badge>
                    {statusMeta && <Badge size="xs" variant="light" color={statusMeta.color}>{statusMeta.label}</Badge>}
                    {source.lastSyncAt && <Text size="10px" c="dimmed">{new Date(source.lastSyncAt).toLocaleDateString("ru-RU")}</Text>}
                  </Group>
                  {/* Единичная ошибка нормальна для публичного каталога, а
                      устойчивая доля падений означает, что площадка сменила
                      разметку или начала блокировать сбор. */}
                  {source.successRate24h !== null && (
                    <Box mt={8}>
                      <Group justify="space-between" gap={4} wrap="nowrap">
                        <Text size="10px" c="dimmed">Успешных прогонов за сутки</Text>
                        <Text size="10px" fw={700}>{source.successRate24h}%</Text>
                      </Group>
                      <Progress
                        mt={3}
                        size="xs"
                        radius="xl"
                        value={source.successRate24h}
                        color={source.successRate24h >= 80 ? "teal" : source.successRate24h >= 50 ? "yellow" : "red"}
                      />
                      <Text size="10px" c="dimmed" mt={3}>
                        {source.runs24h} прогонов
                        {source.failed24h > 0 ? ` · ошибок ${source.failed24h}` : ""}
                        {source.partial24h > 0 ? ` · частично ${source.partial24h}` : ""}
                      </Text>
                    </Box>
                  )}
                </Paper>
              )
            })}
          </SimpleGrid>
        </Card>

            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="monetization">
            <Stack gap="md">
              <ReferralPayoutPanel />
              <Alert
                color={data.monetization.paymentsConfigured ? "teal" : "orange"}
                variant="light"
                title={data.monetization.paymentsConfigured ? "Оплата продвижения подключена" : "Приём платежей ещё не подключён"}
                icon={data.monetization.paymentsConfigured ? <IconLockCheck size={18} /> : <IconAlertTriangle size={18} />}
              >
                {data.monetization.paymentsConfigured
                  ? "Продвижение активируется только после подписанного webhook. Выручка ниже учитывает только подтверждённые заказы."
                  : "Бесплатная активация отключена. Для запуска продаж нужны ключи провайдера и webhook; до этого покупателю показывается честное сообщение, а доход не рисуется."}
              </Alert>

              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                <Card withBorder radius="md" p="md">
                  <ThemeIcon variant="light" color="teal" size={36} radius="md"><IconCoins size={18} /></ThemeIcon>
                  <Text size="xl" fw={850} mt="sm">{data.monetization.confirmedRevenueRub.toLocaleString("ru-RU")} ₽</Text>
                  <Text size="xs" c="dimmed">Подтверждённая выручка</Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconReceipt size={18} /></ThemeIcon>
                  <Text size="xl" fw={850} mt="sm">{data.monetization.paidOrders}</Text>
                  <Text size="xs" c="dimmed">Оплаченных заказов</Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <ThemeIcon variant="light" color="violet" size={36} radius="md"><IconFlame size={18} /></ThemeIcon>
                  <Text size="xl" fw={850} mt="sm">{data.monetization.activePromotions}</Text>
                  <Text size="xs" c="dimmed">Активных продвижений</Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <ThemeIcon variant="light" color={data.monetization.reviewRequiredOrders ? "orange" : "gray"} size={36} radius="md"><IconAlertTriangle size={18} /></ThemeIcon>
                  <Text size="xl" fw={850} mt="sm">{data.monetization.pendingOrders + data.monetization.reviewRequiredOrders}</Text>
                  <Text size="xs" c="dimmed">Ожидают / требуют проверки</Text>
                </Card>
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Card withBorder radius="md" p="md">
                  <Group justify="space-between" mb="md">
                    <Stack gap={1}><Text fw={750}>Выручка по тарифам</Text><Text size="xs" c="dimmed">Только заказы со статусом «Оплачен»</Text></Stack>
                    <Badge variant="light" color="teal">{data.monetization.paidOrders} оплат</Badge>
                  </Group>
                  <Stack gap="sm">
                    {data.monetization.byTariff.map((tariff) => (
                      <Paper key={tariff.tariffId} withBorder radius="md" p="sm">
                        <Group justify="space-between" gap="xs">
                          <Stack gap={1}><Text size="sm" fw={700} tt="uppercase">{tariff.tariffId}</Text><Text size="xs" c="dimmed">{tariff.count} заказов</Text></Stack>
                          <Text fw={850}>{tariff.revenueRub.toLocaleString("ru-RU")} ₽</Text>
                        </Group>
                      </Paper>
                    ))}
                    {!data.monetization.byTariff.length && <Text size="sm" c="dimmed">Подтверждённых платежей пока нет. Нулевое значение — реальное, не демонстрационное.</Text>}
                  </Stack>
                </Card>

                <Card withBorder radius="md" p="md">
                  <Group justify="space-between" mb="md">
                    <Stack gap={1}><Text fw={750}>Последние платёжные заказы</Text><Text size="xs" c="dimmed">Журнал попыток и подтверждений</Text></Stack>
                    <IconCreditCard size={20} color="var(--mantine-color-indigo-6)" />
                  </Group>
                  <Stack gap="xs">
                    {data.monetization.recentOrders.map((order) => {
                      const status = PAYMENT_STATUS_META[order.status] || { label: order.status, color: "gray" as MantineColor }
                      return (
                        <Paper key={order.id} withBorder radius="md" p="xs">
                          <Group justify="space-between" gap="xs" wrap="nowrap">
                            <Stack gap={1} style={{ minWidth: 0 }}>
                              <Text size="sm" fw={700} truncate>{order.listing.title}</Text>
                              <Text size="10px" c="dimmed" truncate>{order.user.name || order.user.email || "Пользователь"} · {new Date(order.createdAt).toLocaleString("ru-RU")}</Text>
                            </Stack>
                            <Stack gap={2} align="flex-end">
                              <Text size="sm" fw={800}>{order.amountRub.toLocaleString("ru-RU")} ₽</Text>
                              <Badge size="xs" variant="light" color={status.color}>{status.label}</Badge>
                            </Stack>
                          </Group>
                        </Paper>
                      )
                    })}
                    {!data.monetization.recentOrders.length && <Text size="sm" c="dimmed">Платёжных заказов пока нет.</Text>}
                  </Stack>
                </Card>
              </SimpleGrid>

              <Card withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon variant="light" color={data.monetization.safeDealConfigured ? "teal" : "blue"} size={42} radius="md"><IconShieldCheck size={21} /></ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={750}>Безопасная сделка и доставка запчастей</Text>
                      <Text size="xs" c="dimmed" maw={680}>Удержание денег до получения будет включено только после договора с лицензированным провайдером. Уже подготовлен кабинет сделки; следующим этапом подключаются платёжные сделки, CDEK и Почта России по выданным ключам.</Text>
                    </Stack>
                  </Group>
                  <Button component={Link} href="/services/safe-deal" variant="light" color="indigo" size="xs">Открыть контур сделки</Button>
                </Group>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="overview">
            <Stack gap="md">

        {c.listings === 0 && (
          <Alert color="blue" variant="light" title="Обычные объявления пока отсутствуют">
            Это чистое состояние после удаления демо-объявлений. Импортный каталог работает отдельно; новые объявления пользователей появятся после модерации.
          </Alert>
        )}

        {/* Основные метрики */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {stats.map((s) => {
            const metricCard = (
              <Card className="admin-metric-card" withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm" align="flex-start" justify="space-between">
                <Stack gap={0}>
                  <Text size="xl" fw={800} c="var(--market-ink)" ff="var(--font-display),sans-serif" lh={1}>{s.value}</Text>
                  <Text size="xs" c="gray.5" mt={2}>{s.label}</Text>
                  {s.new != null && s.new > 0 && (
                    <Group gap={3} mt={4}>
                      <IconTrendingUp size={11} color="#16a34a" />
                      <Text size="10px" c="var(--market-success-text)" fw={600}>+{s.new} за неделю</Text>
                    </Group>
                  )}
                </Stack>
                <ThemeIcon variant="light" color={s.color} size={36} radius="md">{s.icon}</ThemeIcon>
              </Group>
              </Card>
            )

            return s.href ? (
              <Link className="admin-metric-card__link" href={s.href} key={s.label}>{metricCard}</Link>
            ) : <Box key={s.label}>{metricCard}</Box>
          })}
        </SimpleGrid>

        {/* Просмотры сайта и аудитория */}
        <Alert color="indigo" variant="light" title="Как считаются просмотры и уникальные посетители">
          Просмотр — каждое открытие экрана, включая переходы между разделами внутри сайта и смену фильтров каталога. Уникальный посетитель —
          один IP-адрес за период: переходы по разным страницам и сервисам не создают новых уникальных посетителей. Сохраняется только необратимый
          хеш IP; исходный адрес и автоматические bot/headless-запросы не учитываются. Периоды календарные по московскому времени: «сегодня» —
          с 00:00 МСК, «неделя» — с понедельника, «месяц» — с первого числа.
        </Alert>
        <SimpleGrid cols={{ base: 1, xs: 2, lg: 7 }} spacing="sm">
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Group gap="sm"><ThemeIcon variant="light" color="cyan" size={34} radius="md"><IconActivity size={17} /></ThemeIcon><Text size="xs" c="gray.5">Просмотры · сегодня</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data.traffic.pageViewsDay}</Text>
            <Text size="xs" c="gray.4">открытые экраны</Text>
          </Card>
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={34} radius="md"><IconWorld size={17} /></ThemeIcon><Text size="xs" c="gray.5">Уникальные посетители · неделя</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data.traffic.uniqueVisitorsWeek}</Text>
            <Text size="xs" c={data.traffic.uniqueVisitorsTrendWeek >= 0 ? "teal.6" : "red.6"}>{data.traffic.uniqueVisitorsTrendWeek >= 0 ? "+" : ""}{data.traffic.uniqueVisitorsTrendWeek}% к прошлой неделе</Text>
          </Card>
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Group gap="sm"><ThemeIcon variant="light" color="violet" size={34} radius="md"><IconEye size={17} /></ThemeIcon><Text size="xs" c="gray.5">Сессии · неделя</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data.traffic.sessionsWeek}</Text>
            <Text size="xs" c="gray.4">отказы: {data.traffic.bounceRateWeek}%</Text>
          </Card>
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Group gap="sm"><ThemeIcon variant="light" color="teal" size={34} radius="md"><IconUsers size={17} /></ThemeIcon><Text size="xs" c="gray.5">Вошли в аккаунт · неделя</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data.traffic.authenticatedVisitorsWeek}</Text>
            <Text size="xs" c="gray.4">уникальные пользователи</Text>
          </Card>
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Group gap="sm"><ThemeIcon variant="light" color="orange" size={34} radius="md"><IconTrendingUp size={17} /></ThemeIcon><Text size="xs" c="gray.5">Конверсия · неделя</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data.traffic.registrationConversionWeek}%</Text>
            <Text size="xs" c="gray.4">{data.traffic.attributedRegistrationsWeek} новых аккаунтов с визитом</Text>
          </Card>
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Group gap="sm"><ThemeIcon variant="light" color="blue" size={34} radius="md"><IconWorld size={17} /></ThemeIcon><Text size="xs" c="gray.5">Уникальные · месяц</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data.traffic.uniqueVisitorsMonth}</Text>
            <Text size="xs" c="gray.4">{data.traffic.periodLabels.month} · {data.traffic.newVisitorsWeek} новых за неделю</Text>
          </Card>
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Group gap="sm"><ThemeIcon variant="light" color="cyan" size={34} radius="md"><IconBrandTelegram size={17} /></ThemeIcon><Text size="xs" c="gray.5">Telegram Mini App</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data.traffic.telegramMiniAppVisitorsDay}</Text>
            <Text size="xs" c="gray.4">сегодня · {data.traffic.telegramMiniAppVisitorsWeek} за неделю</Text>
          </Card>
        </SimpleGrid>

        <Card className="admin-insight-card" withBorder radius="md" p="md">
          <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" mb="md">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="orange" size={38} radius="md"><IconTag size={19} /></ThemeIcon>
              <Stack gap={1}>
                <Text size="sm" fw={750}>Объявления пользователей · неделя</Text>
                <Text size="xs" c="dimmed">Личные объявления о транспорте и запчастях. Импортные автомобили из раздела аукционов сюда не входят.</Text>
              </Stack>
            </Group>
            <Badge variant="light" color={data.listingPerformance.viewsTrendWeek >= 0 ? "teal" : "red"}>
              {data.listingPerformance.viewsTrendWeek >= 0 ? "+" : ""}{data.listingPerformance.viewsTrendWeek}% просмотров
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="xs">
            {[
              ["Активные", data.listingPerformance.active],
              ["Опубликовано", data.listingPerformance.publishedWeek],
              ["Просмотры", data.listingPerformance.viewsWeek],
              ["Уникальные", data.listingPerformance.uniqueViewersWeek],
              ["Сообщения", data.listingPerformance.messageLeadsWeek],
              ["Продано", data.listingPerformance.soldWeek],
            ].map(([label, value]) => (
              <Paper key={String(label)} withBorder radius="md" p="sm">
                <Text size="lg" fw={850}>{value}</Text>
                <Text size="10px" c="dimmed">{label}</Text>
              </Paper>
            ))}
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mt="md">
            <Paper withBorder radius="md" p="sm">
              <Text size="xs" fw={700} mb="sm">Просмотры по дням</Text>
              <Group h={120} align="flex-end" gap="xs" wrap="nowrap" role="img" aria-label="Просмотры объявлений за семь дней">
                {dailyListingViews.map((point) => {
                  const label = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))
                  const height = point.views ? Math.max(6, Math.round((point.views / maxDailyListingViews) * 88)) : 3
                  return (
                    <Stack key={point.date} gap={4} align="center" style={{ flex: 1, minWidth: 0 }}>
                      <Tooltip label={`${point.views} просмотров · ${point.uniqueViewers} уникальных`} withArrow>
                        <Box h={height} bg={point.views ? "orange.5" : "gray.3"} style={{ width: "clamp(12px, 3vw, 26px)", borderRadius: "6px 6px 2px 2px" }} />
                      </Tooltip>
                      <Text size="9px" c="dimmed">{label}</Text>
                    </Stack>
                  )
                })}
              </Group>
            </Paper>
            <Paper withBorder radius="md" p="sm">
              <Group justify="space-between" mb="sm"><Text size="xs" fw={700}>Лучшие объявления</Text><Badge size="xs" variant="light" color="orange">конверсия {data.listingPerformance.leadConversionWeek}%</Badge></Group>
              <Stack gap="xs">
                {data.listingPerformance.topListings.map((listing) => (
                  <Group key={listing.id} justify="space-between" gap="xs" wrap="nowrap">
                    {listing.href
                      ? <Text component={Link} href={listing.href} size="xs" c="var(--market-ink)" truncate style={{ flex: 1 }}>{listing.title}</Text>
                      : <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>{listing.title}</Text>}
                    <Badge size="xs" variant="light" color="orange">{listing.viewsWeek} / {listing.uniqueViewersWeek}</Badge>
                  </Group>
                ))}
                {!data.listingPerformance.topListings.length && <Text size="xs" c="dimmed">Данные появятся после открытий карточек объявлений.</Text>}
              </Stack>
            </Paper>
          </SimpleGrid>
        </Card>

        <Card className="admin-insight-card" withBorder radius="md" p="md">
          <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
            <Group gap="sm">
              <ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconTrendingUp size={18} /></ThemeIcon>
              <Stack gap={1}>
                <Text size="sm" fw={750}>Просмотры сайта и аудитория за неделю</Text>
                <Text size="xs" c="dimmed">Фиолетовая линия — все открытия страниц, бирюзовая — разные IP-адреса за день.</Text>
              </Stack>
            </Group>
            <Group gap="xs">
              <Badge variant="light" color="indigo">{data.traffic.pagesPerVisitorWeek} стр. / посетителя</Badge>
              <Badge variant="light" color="teal">Регистраций: {dailyTraffic.reduce((sum, point) => sum + point.registrations, 0)}</Badge>
            </Group>
          </Group>
          <Paper withBorder radius="md" p={{ base: "xs", sm: "md" }} bg="gray.0">
            <TrafficLineChart points={dailyTraffic} />
          </Paper>

          <SimpleGrid cols={{ base: 2, xs: 4, sm: 7 }} spacing="xs">
            {dailyTraffic.map((point) => {
              const label = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))
              return (
                <Paper key={point.date} withBorder radius="md" p="xs">
                  <Text size="xs" c="dimmed" fw={700}>{label}</Text>
                  <Text size="lg" fw={850} mt={4}>{point.pageViews}</Text>
                  <Text size="10px" c="dimmed">просмотров · {point.uniqueVisitors} уник.</Text>
                  <Progress value={(point.pageViews / maxDailyPageViews) * 100} color="indigo" size="sm" radius="xl" mt="xs" aria-label={`${label}: ${point.pageViews} просмотров страниц`} />
                    <Group justify="space-between" gap={4} mt={6} wrap="nowrap">
                      <Text size="10px" c="dimmed">рег. {point.registrations}</Text>
                      <Badge size="xs" variant="light" color={point.newListings ? "violet" : "gray"}>{point.newListings} объявл.</Badge>
                    </Group>
                </Paper>
              )
            })}
          </SimpleGrid>
        </Card>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Text size="sm" fw={700} c="var(--market-ink)" mb={2}>Самые просматриваемые разделы · неделя</Text>
            <Text size="xs" c="dimmed" mb="sm">Названия показаны по-русски; число справа — открытия страниц.</Text>
            <Stack gap="xs">
              {data.traffic.topPaths.map((item) => (
                <Group key={item.path} justify="space-between" wrap="nowrap"><Text size="xs" fw={650} c="gray.7" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{screenLabel(item.path)}</Text><Badge size="sm" variant="light" color="indigo">{item.count} просм.</Badge></Group>
              ))}
              {!data.traffic.topPaths.length && <Text size="xs" c="gray.4">Данные появятся после первых просмотров страниц.</Text>}
            </Stack>
          </Card>
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Text size="sm" fw={600} c="var(--market-ink)" mb="sm">Последние идентифицированные посетители</Text>
            <Stack gap="xs">
              {data.traffic.recentVisitors.slice(0, 6).map((visit) => (
                <Group key={visit.id} justify="space-between"><Text size="xs" c="gray.6">{visit.user?.name || visit.user?.email || "Пользователь"}</Text><Text size="xs" c="gray.4">{new Date(visit.createdAt).toLocaleDateString("ru-RU")}</Text></Group>
              ))}
              {!data.traffic.recentVisitors.length && <Text size="xs" c="gray.4">Пока нет авторизованных визитов.</Text>}
            </Stack>
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Text size="sm" fw={700} mb="sm">Устройства уникальных посетителей · неделя</Text>
            <Stack gap="xs">
              {data.traffic.devices.map((item) => (
                <Group key={item.key} justify="space-between"><Text size="xs" c="gray.6">{DEVICE_LABELS[item.key] || item.key}</Text><Badge variant="light" color="cyan">{item.count}</Badge></Group>
              ))}
            </Stack>
          </Card>
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Text size="sm" fw={700} mb="sm">Источники уникальных посетителей · неделя</Text>
            <Stack gap="xs">
              {data.traffic.sources.map((item) => (
                <Group key={item.key} justify="space-between"><Text size="xs" c="gray.6">{item.key.startsWith("UTM:") ? item.key : SOURCE_LABELS[item.key] || item.key}</Text><Badge variant="light" color="violet">{item.count}</Badge></Group>
              ))}
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Распределение по категориям */}
        <Card className="admin-insight-card" withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={600} c="var(--market-ink)">Объявления по категориям транспорта</Text>
            <Badge variant="light" color="indigo" size="sm">{c.listings} всего</Badge>
          </Group>
          <Stack gap="xs">
            {Object.entries(data?.byVehicleType || {}).map(([type, count]) => {
              const pct = Math.round(((count as number) / (c.vehicles || 1)) * 100)
              return (
                <Group gap="sm" key={type}>
                  <Text size="xs" c="gray.6" style={{ width: 90, flexShrink: 0 }}>{VEHICLE_TYPE_LABELS[type] || type}</Text>
                  <Progress value={pct} size="sm" radius="sm" style={{ flex: 1 }} color="indigo" />
                  <Text size="xs" c="gray.5" style={{ width: 40, flexShrink: 0, textAlign: "right" }}>{count as number}</Text>
                </Group>
              )
            })}
          </Stack>
        </Card>

        {/* Доп. статистика */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Stack gap="xs">
              <Group gap="sm"><IconFlame size={16} color="#f97316" /><Text size="xs" c="gray.5">Премиум-объявления</Text></Group>
              <Text size="xl" fw={700} c="var(--market-ink)">{data?.featured ?? 0}</Text>
              <Text size="xs" c="gray.4">{Math.round(((data?.featured ?? 0) / total) * 100)}% от всех</Text>
            </Stack>
          </Card>
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Stack gap="xs">
              <Group gap="sm"><IconTrendingUp size={16} color="#16a34a" /><Text size="xs" c="gray.5">Средняя цена</Text></Group>
              <Text size="xl" fw={700} c="var(--market-ink)">{data?.avgPrice?.toLocaleString("ru-RU") ?? 0} ₽</Text>
              <Text size="xs" c="gray.4">по всем объявлениям</Text>
            </Stack>
          </Card>
          <Card className="admin-insight-card" withBorder radius="md" p="md">
            <Stack gap="xs">
              <Group gap="sm"><IconUsers size={16} color="#1c4291" /><Text size="xs" c="gray.5">Роли</Text></Group>
              {Object.entries(data?.byRole || {}).map(([role, count]) => (
                <Group key={role} justify="space-between">
                  <Text size="xs" c="gray.6">{role}</Text>
                  <Text size="xs" fw={600} c="var(--market-ink)">{count as number}</Text>
                </Group>
              ))}
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Быстрые действия */}
        <Card className="admin-insight-card" withBorder radius="md" p="md">
          <Text size="sm" fw={600} c="var(--market-ink)" mb="sm">Управление</Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Card className="admin-action-card" component={Link} href="/admin/users" withBorder radius="md" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconUsers size={16} /></ThemeIcon><Text size="xs" fw={500}>Пользователи</Text></Group>
            </Card>
            <Card className="admin-action-card" component={Link} href="/moderation" withBorder radius="md" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="blue" size={32} radius="md"><IconCar size={16} /></ThemeIcon><Text size="xs" fw={500}>Объявления</Text></Group>
            </Card>
            <Card className="admin-action-card" component={Link} href="/parts-finder" withBorder radius="md" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="green" size={32} radius="md"><IconTag size={16} /></ThemeIcon><Text size="xs" fw={500}>Запчасти</Text></Group>
            </Card>
            <Card className="admin-action-card" component={Link} href="/messages" withBorder radius="md" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="cyan" size={32} radius="md"><IconMessageCircle2 size={16} /></ThemeIcon><Text size="xs" fw={500}>Сообщения</Text></Group>
            </Card>
          </SimpleGrid>
        </Card>

            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="moderation">
            <Stack gap="md">
        {/* Модерация объявлений */}
        <ListingModerationPanel />
        <ListingReportModerationPanel />
        <PartStoreModerationPanel />
        <AdminAuditLog />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Box>
  )
}
