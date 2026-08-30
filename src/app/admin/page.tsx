"use client"
export const dynamic = "force-dynamic"


import useSWR from "swr"
import { ActionIcon, Alert, Box, Stack, Text, Center, Loader, SimpleGrid, Card, Paper, ThemeIcon, Title, Group, Badge, Progress, Button, Tooltip, Timeline, Tabs } from "@mantine/core"
import type { MantineColor } from "@mantine/core"
import { IconUsers, IconCar, IconTag, IconMessageCircle2, IconStar, IconBell, IconEye, IconFlame, IconTrendingUp, IconRobot, IconActivity, IconWorld, IconRefresh, IconDatabase, IconGavel, IconAlertTriangle, IconBuildingWarehouse, IconCheck, IconClock, IconListCheck, IconShieldCheck, IconCreditCard, IconCoins, IconReceipt, IconLockCheck, IconHeadset, IconBrandTelegram } from "@tabler/icons-react"
import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import ListingModerationPanel from "@/components/moderation/ListingModerationPanel"
import ListingReportModerationPanel from "@/components/moderation/ListingReportModerationPanel"
import AdminAuditLog from "@/components/admin/AdminAuditLog"
import PartStoreModerationPanel from "@/components/admin/PartStoreModerationPanel"
import ReferralPayoutPanel from "@/components/admin/ReferralPayoutPanel"
import TrafficLineChart from "@/components/admin/TrafficLineChart"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { compareByUrgency, formatQueueAge, queueUrgency } from "@/lib/queue-age"
import { fetchJson } from "@/lib/api-client"
import { formatAdminDateTime } from "@/lib/admin-datetime"
import {
  AUCTION_OPERATIONAL_STATUS_LABELS,
  formatAuctionSyncDuration,
  type AuctionOperationalStatus,
} from "@/lib/auction-source-health"

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
    completenessPercent: number | null
    fields: Array<{ key: string; label: string; filled: number; missing: number; percent: number | null }>
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
  sourceHealth: Array<{
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
    latestRunStatus: string | null
    latestRunKind: string | null
    latestRunStartedAt: string | null
    latestRunCompletedAt: string | null
    latestRunDurationSeconds: number | null
    consecutiveIssues: number
    latestRunError: string | null
  }>
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

const SOURCE_RUN_STATUS_META: Record<AuctionOperationalStatus, { color: MantineColor }> = {
  HEALTHY: { color: "teal" },
  RUNNING: { color: "blue" },
  DEGRADED: { color: "yellow" },
  FAILED: { color: "red" },
  STUCK: { color: "red" },
  NOT_RUN: { color: "gray" },
}

function sourceNeedsAttention(source: AuctionAdminStats["sourceHealth"][number]) {
  return source.stale > 0
    || source.pendingRemoval > 0
    || source.qualityHold > 0
    || ["DEGRADED", "FAILED", "STUCK", "NOT_RUN"].includes(source.operationalStatus)
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

const ADMIN_TABS = ["overview", "operations", "sources", "monetization", "moderation"] as const

export default function AdminDashboard() {
  /* Выбранная вкладка живёт в адресе.

     Раньше она нигде не сохранялась: обновил страницу — вернулся на
     «Обзор», а ссылкой на нужную вкладку поделиться было нельзя.
     Администратор разбирает очередь задач и после каждой правки
     возвращался к началу.

     Читаем после первой отрисовки: на сервере адреса нет, и решение,
     принятое там, разошлось бы с клиентским. */
  const [tab, setTab] = useState<string | null>(null)

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab")
    if (requested && (ADMIN_TABS as readonly string[]).includes(requested)) setTab(requested)
  }, [])

  const changeTab = (value: string | null) => {
    if (!value) return
    setTab(value)
    /* replaceState, а не push: вкладки — это не переходы по страницам, и
       кнопка «назад» должна уводить из админки, а не листать вкладки. */
    const url = new URL(window.location.href)
    url.searchParams.set("tab", value)
    window.history.replaceState(null, "", url.toString())
  }

  const { data, error, isLoading, isValidating, mutate } = useSWR<AdminStats>("/api/admin/stats", fetchAdminStats)
  const { data: auctionStats, isValidating: isAuctionStatsValidating, mutate: mutateAuctionStats } = useSWR<AuctionAdminStats>("/api/admin/auctions/stats", fetchJson)

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
    /* Каждая карточка открывает свой раздел.

       Раньше вели только «Пользователи» и «Поддержка»: остальные семь
       показывали число и не нажимались. Администратор видел «25
       уведомлений» и не мог их открыть — счётчик без перехода читается
       как поломка, а не как решение показать одну цифру. */
    { label: "Объявления", value: c.listings, icon: <IconTag size={18} />, color: "blue", href: "/moderation", new: data.recent.newListings },
    { label: "Транспорт", value: c.vehicles, icon: <IconCar size={18} />, color: "teal", href: "/?type=vehicle" },
    { label: "Запчасти", value: c.parts, icon: <IconCar size={18} />, color: "green", href: "/parts-finder" },
    { label: "Сообщения", value: c.messages, icon: <IconMessageCircle2 size={18} />, color: "cyan", href: "/messages" },
    { label: "Отзывы", value: c.reviews, icon: <IconStar size={18} />, color: "orange", href: "/moderation" },
    { label: "Уведомления", value: c.notifications, icon: <IconBell size={18} />, color: "red", href: "/notifications" },
    { label: "AI-запросы", value: c.aiLogs, icon: <IconRobot size={18} />, color: "violet", href: "/admin/traffic" },
    { label: "Поддержка", value: c.supportTickets, icon: <IconHeadset size={18} />, color: "grape", href: "/admin/support" },
  ]

  const total = c.listings || 1
  const dailyTraffic = data.traffic.daily || []
  const maxDailyPageViews = Math.max(1, ...dailyTraffic.map((point) => point.pageViews))
  const dailyListingViews = data.listingPerformance.daily || []
  const maxDailyListingViews = Math.max(1, ...dailyListingViews.map((point) => point.views))
  const listingViewsToday = dailyListingViews.at(-1)?.views ?? 0
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
                {/* На эту метку смотрят первым делом — она и открывает
                    очередь. Раньше она только сообщала число, и до
                    задач приходилось добираться вкладкой ниже. */}
                <Badge
                  variant="dot"
                  color={actionsTotal > 0 ? "orange" : "teal"}
                  size="sm"
                  component="button"
                  type="button"
                  onClick={() => changeTab("operations")}
                  style={{ cursor: "pointer" }}
                >
                  {actionsTotal > 0 ? `${actionsTotal} ждут решения` : "Очередь разобрана"}
                </Badge>
                {lastSyncLabel && <Badge variant="dot" color="gray" size="sm">Импорт: {lastSyncLabel}</Badge>}
              </Group>
              <Title order={2} size="h3" c="white" ff="var(--font-display),sans-serif">Администрирование Авторынка</Title>
              <Text size="sm" className="admin-workspace__hero-copy">Пользователи, объявления и модерация — в одном рабочем пространстве.</Text>
            </Stack>
            <Group gap="xs">
              <Tooltip label="Обновить реальные показатели">
                <ActionIcon variant="white" color="dark" size="lg" loading={isValidating || isAuctionStatsValidating} aria-label="Обновить показатели" onClick={() => void refreshDashboard()}><IconRefresh size={17} /></ActionIcon>
              </Tooltip>
              <Button component={Link} href="/admin/users" variant="white" color="dark" size="sm">Пользователи</Button>
              <Button component={Link} href="/admin/auctions" variant="outline" color="gray" size="sm" className="admin-workspace__hero-outline-action">Заявки</Button>
              <Button component={Link} href="/admin/partners" variant="outline" color="gray" size="sm" className="admin-workspace__hero-outline-action">Партнёры</Button>
            </Group>
          </Group>
        </Card>

        {/* Панель открывается на том, что требует решения: если очередь не
            разобрана, статистика подождёт. При пустой очереди сразу виден
            обзор, а не пустой список задач. */}
        <Tabs
          value={tab || (actionsTotal > 0 ? "operations" : "overview")}
          onChange={changeTab}
          variant="pills"
          color="indigo"
          keepMounted={false}
        >
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
                    В поиске: {auctionStats.visibleAuctions} из {auctionStats.totalAuctions} актуальных лотов. {auctionStats.lastAuctionSync ? `Последняя синхронизация: ${formatAdminDateTime(auctionStats.lastAuctionSync)}.` : "Синхронизация ещё не зафиксирована."}
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
                <Text size="sm" fw={700}>Оперативная очередь</Text>
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
                      <Text size="xl" fw={800} lh={1} c={item.value ? undefined : "dimmed"}>{item.value}</Text>
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

        <Card withBorder radius="md" p="md" className="admin-source-health">
          <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="teal" size={36} radius="md"><IconActivity size={18} /></ThemeIcon>
              <Stack gap={1}>
                <Text size="sm" fw={700}>Здоровье аукционных источников</Text>
                <Text size="xs" c="dimmed">Свежесть считается по собственному нормативу каждой площадки, а не по одному общему таймеру.</Text>
              </Stack>
            </Group>
            {auctionStats?.sourceHealth.length ? (
              <Badge
                variant="light"
                color={auctionStats.sourceHealth.some(sourceNeedsAttention) ? "orange" : "teal"}
              >
                {auctionStats.sourceHealth.filter(sourceNeedsAttention).length
                  ? `Требуют внимания: ${auctionStats.sourceHealth.filter(sourceNeedsAttention).length}`
                  : "Все источники в норме"}
              </Badge>
            ) : null}
          </Group>
          {auctionStats?.sourceHealth.length ? (
            <Stack gap={7}>
              {auctionStats.sourceHealth.map((source) => {
                const healthColor: MantineColor = source.active === 0
                  ? "gray"
                  : source.freshPercent !== null && source.freshPercent >= 80 && source.pendingRemoval === 0
                    ? "teal"
                    : source.freshPercent !== null && source.freshPercent >= 50
                      ? "yellow"
                      : "red"
                const lastActivity = source.latestSeenAt || source.latestRunAt
                const runMeta = SOURCE_RUN_STATUS_META[source.operationalStatus]
                const runDuration = formatAuctionSyncDuration(source.latestRunDurationSeconds)
                return (
                  <Paper
                    key={source.source}
                    withBorder
                    radius="md"
                    p="sm"
                    className="admin-source-health__row"
                    data-health={healthColor}
                    data-operational={source.operationalStatus}
                  >
                    <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                      <Box className="admin-source-health__identity">
                        <Group gap={7} wrap="nowrap">
                          <Box className="admin-source-health__signal" data-color={healthColor} aria-hidden="true" />
                          <Text size="sm" fw={750}>{source.label}</Text>
                          <Badge size="xs" variant="light" color="gray">{source.country || "—"}</Badge>
                        </Group>
                        <Text size="10px" c="dimmed" mt={3}>
                          Норматив: до {source.expectedRefreshHours} ч
                          {lastActivity ? ` · активность ${new Date(lastActivity).toLocaleString("ru-RU")}` : " · запусков ещё нет"}
                          {runDuration ? ` · последний запуск ${runDuration}` : ""}
                        </Text>
                        {source.latestRunError && (
                          <Text size="10px" c="red.7" mt={3} lineClamp={1} title={source.latestRunError}>
                            {source.latestRunError}
                          </Text>
                        )}
                      </Box>
                      <Box className="admin-source-health__freshness">
                        <Group justify="space-between" gap="xs" wrap="nowrap">
                          <Text size="10px" c="dimmed">Свежие лоты</Text>
                          <Text size="xs" fw={800} style={{ fontVariantNumeric: "tabular-nums" }}>
                            {source.fresh.toLocaleString("ru-RU")} / {source.active.toLocaleString("ru-RU")}
                          </Text>
                        </Group>
                        <Progress mt={4} size="sm" radius="xl" value={source.freshPercent ?? 0} color={healthColor} />
                      </Box>
                      <Group gap={5} wrap="wrap" className="admin-source-health__flags">
                        <Badge size="xs" variant="light" color={runMeta.color}>
                          {AUCTION_OPERATIONAL_STATUS_LABELS[source.operationalStatus]}
                        </Badge>
                        {source.consecutiveIssues > 1 && <Badge size="xs" variant="light" color="red">Серия проблем: {source.consecutiveIssues}</Badge>}
                        {source.stale > 0 && <Badge size="xs" variant="light" color="orange">Устарели: {source.stale}</Badge>}
                        {source.pendingRemoval > 0 && <Badge size="xs" variant="light" color="red">Проверка снятия: {source.pendingRemoval}</Badge>}
                        {source.qualityHold > 0 && <Badge size="xs" variant="light" color="grape">Карантин: {source.qualityHold}</Badge>}
                        {source.active === 0 && source.qualityHold === 0 && <Badge size="xs" variant="light" color="gray">Нет активных лотов</Badge>}
                        {source.active > 0 && source.stale === 0 && source.pendingRemoval === 0 && <Badge size="xs" variant="light" color="teal">Актуален</Badge>}
                      </Group>
                    </Group>
                  </Paper>
                )
              })}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">Данные появятся после первого запуска любого аукционного источника.</Text>
          )}
        </Card>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm" wrap="wrap">
            <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconDatabase size={18} /></ThemeIcon><Box><Text size="sm" fw={700}>Последние синхронизации источников</Text><Text size="xs" c="dimmed">Диагностика импорта без запуска парсера из интерфейса.</Text></Box></Group>
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
                <Text size="sm" fw={700}>Полнота полей по источникам</Text>
                <Text size="xs" c="dimmed">Только активные публичные лоты. Низкий процент — сигнал проверить парсер или доступность поля у площадки.</Text>
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
                      <Badge size="xs" variant="light" color="gray">{row.total.toLocaleString("ru-RU")} активных лотов</Badge>
                      {row.completenessPercent !== null && (
                        <Badge
                          size="xs"
                          variant="light"
                          color={row.completenessPercent >= 80 ? "teal" : row.completenessPercent >= 50 ? "yellow" : "red"}
                        >
                          Полнота {row.completenessPercent}%
                        </Badge>
                      )}
                    </Group>
                    {row.quarantined > 0 && <Badge size="xs" variant="light" color="orange">Скрыто: {row.quarantined}</Badge>}
                  </Group>
                  {row.total > 0 && row.fields.some((field) => field.percent !== null && field.percent < 40) && (
                    <Group gap={5} mb="xs" wrap="wrap">
                      <Text size="10px" c="dimmed">Требуют проверки:</Text>
                      {row.fields.filter((field) => field.percent !== null && field.percent < 40).map((field) => (
                        <Badge key={field.key} size="xs" variant="outline" color="red">
                          {field.label}: {field.percent}%
                        </Badge>
                      ))}
                    </Group>
                  )}
                  <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="xs">
                    {row.fields.map((field) => (
                      <Box key={field.key}>
                        <Group justify="space-between" gap={4} wrap="nowrap">
                          <Text size="xs" c="dimmed" truncate>{field.label}</Text>
                          <Text size="xs" fw={700} title={field.percent === null ? "Нет активных лотов" : `${field.filled} из ${row.total}`}>
                            {field.percent === null ? "—" : `${field.percent}%`}
                          </Text>
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
                <Text size="sm" fw={700}>Реестр источников импорта</Text>
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
                    <Text size="sm" fw={700} lineClamp={1}>{source.label}</Text>
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
                  <Text size="xl" fw={800} mt="sm">{data.monetization.confirmedRevenueRub.toLocaleString("ru-RU")} ₽</Text>
                  <Text size="xs" c="dimmed">Подтверждённая выручка</Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconReceipt size={18} /></ThemeIcon>
                  <Text size="xl" fw={800} mt="sm">{data.monetization.paidOrders}</Text>
                  <Text size="xs" c="dimmed">Оплаченных заказов</Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <ThemeIcon variant="light" color="violet" size={36} radius="md"><IconFlame size={18} /></ThemeIcon>
                  <Text size="xl" fw={800} mt="sm">{data.monetization.activePromotions}</Text>
                  <Text size="xs" c="dimmed">Активных продвижений</Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <ThemeIcon variant="light" color={data.monetization.reviewRequiredOrders ? "orange" : "gray"} size={36} radius="md"><IconAlertTriangle size={18} /></ThemeIcon>
                  <Text size="xl" fw={800} mt="sm">{data.monetization.pendingOrders + data.monetization.reviewRequiredOrders}</Text>
                  <Text size="xs" c="dimmed">Ожидают / требуют проверки</Text>
                </Card>
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Card withBorder radius="md" p="md">
                  <Group justify="space-between" mb="md">
                    <Stack gap={1}><Text fw={700}>Выручка по тарифам</Text><Text size="xs" c="dimmed">Только заказы со статусом «Оплачен»</Text></Stack>
                    <Badge variant="light" color="teal">{data.monetization.paidOrders} оплат</Badge>
                  </Group>
                  <Stack gap="sm">
                    {data.monetization.byTariff.map((tariff) => (
                      <Paper key={tariff.tariffId} withBorder radius="md" p="sm">
                        <Group justify="space-between" gap="xs">
                          <Stack gap={1}><Text size="sm" fw={700} tt="uppercase">{tariff.tariffId}</Text><Text size="xs" c="dimmed">{tariff.count} заказов</Text></Stack>
                          <Text fw={800}>{tariff.revenueRub.toLocaleString("ru-RU")} ₽</Text>
                        </Group>
                      </Paper>
                    ))}
                    {!data.monetization.byTariff.length && <Text size="sm" c="dimmed">Подтверждённых платежей пока нет. Нулевое значение — реальное, не демонстрационное.</Text>}
                  </Stack>
                </Card>

                <Card withBorder radius="md" p="md">
                  <Group justify="space-between" mb="md">
                    <Stack gap={1}><Text fw={700}>Последние платёжные заказы</Text><Text size="xs" c="dimmed">Журнал попыток и подтверждений</Text></Stack>
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
                      <Text fw={700}>Безопасная сделка и доставка запчастей</Text>
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
          «Экраны сайта» учитывают все разделы, переходы и смену фильтров каталога. Блок «Объявления пользователей» ниже считает только
          открытия карточек транспорта и запчастей, поэтому эти показатели нельзя сравнивать напрямую. Уникальный посетитель определяется по необратимому хешу
          IP; исходный адрес и автоматические bot/headless-запросы не учитываются. Периоды календарные по московскому времени.
        </Alert>
        <SimpleGrid cols={{ base: 1, xs: 2, lg: 7 }} spacing="sm">
          {/* Семь карточек раскрывались вручную — тридцать пять строк
              почти одинаковой разметки. Перебор по массиву: правка вида
              теперь делается в одном месте, а не в семи. */}
          {[
            { icon: <IconActivity size={17} />, color: "cyan", label: "Экраны сайта · сегодня", value: data.traffic.pageViewsDay, hint: `${data.traffic.pageViewsWeek} за неделю · все разделы` },
            { icon: <IconWorld size={17} />, color: "indigo", label: "Уникальные посетители · неделя", value: data.traffic.uniqueVisitorsWeek, trend: data.traffic.uniqueVisitorsTrendWeek },
            { icon: <IconEye size={17} />, color: "violet", label: "Сессии · неделя", value: data.traffic.sessionsWeek, hint: `отказы: ${data.traffic.bounceRateWeek}%` },
            { icon: <IconUsers size={17} />, color: "teal", label: "Вошли в аккаунт · неделя", value: data.traffic.authenticatedVisitorsWeek, hint: "уникальные пользователи" },
            { icon: <IconTrendingUp size={17} />, color: "orange", label: "Конверсия · неделя", value: `${data.traffic.registrationConversionWeek}%`, hint: `${data.traffic.attributedRegistrationsWeek} новых аккаунтов с визитом` },
            { icon: <IconWorld size={17} />, color: "blue", label: "Уникальные · месяц", value: data.traffic.uniqueVisitorsMonth, hint: `${data.traffic.periodLabels.month} · ${data.traffic.newVisitorsWeek} новых за неделю` },
            { icon: <IconBrandTelegram size={17} />, color: "cyan", label: "Telegram Mini App", value: data.traffic.telegramMiniAppVisitorsDay, hint: `сегодня · ${data.traffic.telegramMiniAppVisitorsWeek} за неделю` },
          ].map((card) => (
            <Card key={card.label} className="admin-insight-card" withBorder radius="md" p="md">
              <Group gap="sm">
                <ThemeIcon variant="light" color={card.color} size={34} radius="md">{card.icon}</ThemeIcon>
                <Text size="xs" c="gray.5">{card.label}</Text>
              </Group>
              <Text size="xl" fw={800} mt="sm" style={{ fontVariantNumeric: "tabular-nums" }}>{card.value}</Text>
              {typeof card.trend === "number" ? (
                <Text size="xs" c={card.trend >= 0 ? "teal.6" : "red.6"}>
                  {card.trend >= 0 ? "+" : ""}{card.trend}% к прошлой неделе
                </Text>
              ) : (
                <Text size="xs" c="gray.4">{card.hint}</Text>
              )}
            </Card>
          ))}
        </SimpleGrid>

        <Card className="admin-insight-card" withBorder radius="md" p="md">
          <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" mb="md">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="orange" size={38} radius="md"><IconTag size={19} /></ThemeIcon>
              <Stack gap={1}>
                <Text size="sm" fw={700}>Объявления пользователей · последние 7 дней</Text>
                <Text size="xs" c="dimmed">Открытия карточек личных объявлений о транспорте и запчастях. Импортные автомобили из раздела аукционов сюда не входят.</Text>
              </Stack>
            </Group>
            <Badge variant="light" color={data.listingPerformance.viewsTrendWeek >= 0 ? "teal" : "red"}>
              {data.listingPerformance.viewsTrendWeek >= 0 ? "+" : ""}{data.listingPerformance.viewsTrendWeek}% к предыдущим 7 дням
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="xs">
            {[
              { label: "Активные", value: data.listingPerformance.active, detail: "публично видны" },
              { label: "Опубликовано", value: data.listingPerformance.publishedWeek, detail: "за 7 дней" },
              { label: "Открытия карточек", value: data.listingPerformance.viewsWeek, detail: `${listingViewsToday} сегодня · ${data.listingPerformance.totalViews} за всё время` },
              { label: "Уникальные", value: data.listingPerformance.uniqueViewersWeek, detail: "за 7 дней" },
              { label: "Сообщения", value: data.listingPerformance.messageLeadsWeek, detail: "за 7 дней" },
              { label: "Продано", value: data.listingPerformance.soldWeek, detail: "за 7 дней" },
            ].map(({ label, value, detail }) => (
              <Paper key={String(label)} withBorder radius="md" p="sm">
                <Text size="lg" fw={800}>{value}</Text>
                <Text size="10px" c="dimmed">{label}</Text>
                <Text size="9px" c="gray.5" mt={2}>{detail}</Text>
              </Paper>
            ))}
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mt="md">
            <Paper withBorder radius="md" p="sm">
              <Text size="xs" fw={700} mb="sm">Открытия карточек по дням</Text>
              <Group h={120} align="flex-end" gap="xs" wrap="nowrap" role="img" aria-label="Открытия карточек объявлений за семь дней">
                {dailyListingViews.map((point) => {
                  const label = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))
                  const height = point.views ? Math.max(6, Math.round((point.views / maxDailyListingViews) * 88)) : 3
                  return (
                    <Stack key={point.date} gap={4} align="center" style={{ flex: 1, minWidth: 0 }}>
                      <Tooltip label={`${point.views} открытий · ${point.uniqueViewers} уникальных посетителей`} withArrow>
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
                <Text size="sm" fw={700}>Просмотры сайта и аудитория за неделю</Text>
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
                  <Text size="lg" fw={800} mt={4}>{point.pageViews}</Text>
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
                <Group key={item.path} justify="space-between" wrap="nowrap"><Text size="xs" fw={600} c="gray.7" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{screenLabel(item.path)}</Text><Badge size="sm" variant="light" color="indigo">{item.count} просм.</Badge></Group>
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
            {/* Поддержка, форум и посещаемость — то, куда администратор
                ходит каждый день, и до них приходилось добираться через
                верхний ряд разделов. */}
            <Card className="admin-action-card" component={Link} href="/admin/support" withBorder radius="md" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="grape" size={32} radius="md"><IconHeadset size={16} /></ThemeIcon><Text size="xs" fw={500}>Поддержка</Text></Group>
            </Card>
            <Card className="admin-action-card" component={Link} href="/admin/forum" withBorder radius="md" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="teal" size={32} radius="md"><IconMessageCircle2 size={16} /></ThemeIcon><Text size="xs" fw={500}>Форум</Text></Group>
            </Card>
            <Card className="admin-action-card" component={Link} href="/admin/traffic" withBorder radius="md" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="violet" size={32} radius="md"><IconActivity size={16} /></ThemeIcon><Text size="xs" fw={500}>Посещаемость</Text></Group>
            </Card>
            <Card className="admin-action-card" component={Link} href="/admin/telegram" withBorder radius="md" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="blue" size={32} radius="md"><IconBrandTelegram size={16} /></ThemeIcon><Text size="xs" fw={500}>Рассылка</Text></Group>
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
