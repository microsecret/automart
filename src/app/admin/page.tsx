"use client"
export const dynamic = "force-dynamic"


import useSWR from "swr"
import { ActionIcon, Alert, Box, Stack, Text, Center, Loader, SimpleGrid, Card, Paper, ThemeIcon, Title, Group, Badge, Progress, Button, Tooltip, Timeline, Tabs } from "@mantine/core"
import type { MantineColor } from "@mantine/core"
import { IconUsers, IconCar, IconTag, IconMessageCircle2, IconStar, IconBell, IconEye, IconFlame, IconTrendingUp, IconRobot, IconActivity, IconWorld, IconRefresh, IconDatabase, IconGavel, IconAlertTriangle, IconBuildingWarehouse, IconCheck, IconClock, IconListCheck, IconShieldCheck, IconCreditCard, IconCoins, IconReceipt, IconLockCheck, IconHeadset } from "@tabler/icons-react"
import Link from "next/link"
import type { ReactNode } from "react"
import ListingModerationPanel from "@/components/moderation/ListingModerationPanel"
import ListingReportModerationPanel from "@/components/moderation/ListingReportModerationPanel"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
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
    visits24h: number
    visits7d: number
    uniqueVisitors7d: number
    daily: Array<{ date: string; visits: number; registrations: number }>
    topPaths: Array<{ path: string; count: number }>
    recentVisitors: Array<{
      id: string
      createdAt: string
      user: { id: string; name: string | null; email: string | null; telegramUsername: string | null } | null
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
    pipeline: "PUBLIC_COLLECTOR" | "PARTNER_FEED"
    pipelineLabel: string
    lastStatus: string | null
    lastSyncAt: string | null
  }>
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
  const maxDailyVisits = Math.max(1, ...dailyTraffic.map((point) => point.visits))
  const maxDailyRegistrations = Math.max(1, ...dailyTraffic.map((point) => point.registrations))
  const operationItems = [
    { label: "Объявления на проверке", value: data.operations.pendingListings, href: "/moderation", icon: <IconListCheck size={17} />, color: "orange" as MantineColor, description: "Проверить и принять решение" },
    { label: "Открытые жалобы", value: data.operations.openReports, href: "/moderation", icon: <IconAlertTriangle size={17} />, color: "red" as MantineColor, description: "Разобрать обращения пользователей" },
    { label: "Новые заявки на импорт", value: data.operations.newAuctionInquiries, href: "/admin/auctions", icon: <IconGavel size={17} />, color: "indigo" as MantineColor, description: "Связаться с клиентами" },
    { label: "Импорт в работе", value: data.operations.activeAuctionInquiries, href: "/admin/auctions", icon: <IconClock size={17} />, color: "blue" as MantineColor, description: "Проверить этап сделок" },
    { label: "Партнёры ждут проверки", value: data.operations.pendingDeliveryOrganizations, href: "/admin/partners", icon: <IconBuildingWarehouse size={17} />, color: "violet" as MantineColor, description: "Проверить реквизиты в реестре" },
    { label: "Поддержка ждёт оператора", value: data.operations.waitingSupportTickets, href: "/admin/support?status=WAITING_OPERATOR", icon: <IconHeadset size={17} />, color: "grape" as MantineColor, description: `${data.operations.openSupportTickets} открыто · ${data.operations.activeSupportTickets} в работе` },
  ]
  const actionsTotal = operationItems.reduce((sum, item) => sum + item.value, 0)

  return (
    <Box className="admin-workspace" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Card className="admin-workspace__hero" radius="lg" p={{ base: "md", sm: "lg" }}>
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <Stack gap={5}>
              <Group gap={6}>
                <Badge variant="white" color="indigo" size="sm">ПАНЕЛЬ УПРАВЛЕНИЯ</Badge>
                <Badge variant="dot" color="teal" size="sm">Система онлайн</Badge>
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

        <Tabs defaultValue="overview" variant="pills" color="indigo" keepMounted={false}>
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
          <Card withBorder radius="lg" p="md">
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

        <Card withBorder radius="lg" p="md">
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
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="xs" mt="md">
            {operationItems.map((item) => (
              <Button key={item.label} component={Link} href={item.href} variant={item.value ? "light" : "subtle"} color={item.color} h="auto" p="sm" justify="flex-start" styles={{ inner: { alignItems: "flex-start" }, label: { textAlign: "left", whiteSpace: "normal" } }} leftSection={<ThemeIcon variant="white" color={item.color} size={30} radius="md">{item.icon}</ThemeIcon>}>
                <Stack gap={1} align="flex-start">
                  <Text size="lg" fw={850} lh={1}>{item.value}</Text>
                  <Text size="xs" fw={700}>{item.label}</Text>
                  <Text size="10px" c="dimmed" fw={400}>{item.description}</Text>
                </Stack>
              </Button>
            ))}
          </SimpleGrid>
        </Card>

            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="sources">
            <Stack gap="md">

        <Card withBorder radius="lg" p="md">
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

        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
            <Group gap="sm">
              <ThemeIcon variant="light" color="cyan" size={36} radius="md"><IconWorld size={18} /></ThemeIcon>
              <Stack gap={1}>
                <Text size="sm" fw={750}>Реестр источников импорта</Text>
                <Text size="xs" c="dimmed">Статус отражает фактический способ получения данных, а не только доступность страны в фильтре.</Text>
              </Stack>
            </Group>
            <Badge variant="light" color="teal">Активных сборщиков: {data.sourceCoverage.filter((source) => source.pipeline === "PUBLIC_COLLECTOR").length}</Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }} spacing="xs">
            {data.sourceCoverage.map((source) => {
              const isCollector = source.pipeline === "PUBLIC_COLLECTOR"
              const statusMeta = source.lastStatus ? SYNC_STATUS_META[source.lastStatus] : null
              return (
                <Paper key={source.source} withBorder radius="md" p="sm">
                  <Group justify="space-between" gap="xs" wrap="nowrap">
                    <Text size="sm" fw={750} lineClamp={1}>{source.label}</Text>
                    <Badge size="xs" variant="light" color={isCollector ? "teal" : "gray"}>{source.country || "—"}</Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>{source.pipelineLabel}</Text>
                  <Group gap={5} mt="xs" wrap="wrap">
                    <Badge size="xs" variant="dot" color={isCollector ? "teal" : "gray"}>{isCollector ? "Сборщик включён" : "Ожидает подключение"}</Badge>
                    {statusMeta && <Badge size="xs" variant="light" color={statusMeta.color}>{statusMeta.label}</Badge>}
                    {source.lastSyncAt && <Text size="10px" c="dimmed">{new Date(source.lastSyncAt).toLocaleDateString("ru-RU")}</Text>}
                  </Group>
                </Paper>
              )
            })}
          </SimpleGrid>
        </Card>

            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="monetization">
            <Stack gap="md">
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
                <Card withBorder radius="lg" p="md">
                  <ThemeIcon variant="light" color="teal" size={36} radius="md"><IconCoins size={18} /></ThemeIcon>
                  <Text size="xl" fw={850} mt="sm">{data.monetization.confirmedRevenueRub.toLocaleString("ru-RU")} ₽</Text>
                  <Text size="xs" c="dimmed">Подтверждённая выручка</Text>
                </Card>
                <Card withBorder radius="lg" p="md">
                  <ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconReceipt size={18} /></ThemeIcon>
                  <Text size="xl" fw={850} mt="sm">{data.monetization.paidOrders}</Text>
                  <Text size="xs" c="dimmed">Оплаченных заказов</Text>
                </Card>
                <Card withBorder radius="lg" p="md">
                  <ThemeIcon variant="light" color="violet" size={36} radius="md"><IconFlame size={18} /></ThemeIcon>
                  <Text size="xl" fw={850} mt="sm">{data.monetization.activePromotions}</Text>
                  <Text size="xs" c="dimmed">Активных продвижений</Text>
                </Card>
                <Card withBorder radius="lg" p="md">
                  <ThemeIcon variant="light" color={data.monetization.reviewRequiredOrders ? "orange" : "gray"} size={36} radius="md"><IconAlertTriangle size={18} /></ThemeIcon>
                  <Text size="xl" fw={850} mt="sm">{data.monetization.pendingOrders + data.monetization.reviewRequiredOrders}</Text>
                  <Text size="xs" c="dimmed">Ожидают / требуют проверки</Text>
                </Card>
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Card withBorder radius="lg" p="md">
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

                <Card withBorder radius="lg" p="md">
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

              <Card withBorder radius="lg" p="md">
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
              <Card className="admin-metric-card" withBorder radius="lg" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm" align="flex-start" justify="space-between">
                <Stack gap={0}>
                  <Text size="xl" fw={800} c="dark.9" ff="var(--font-display),sans-serif" lh={1}>{s.value}</Text>
                  <Text size="xs" c="gray.5" mt={2}>{s.label}</Text>
                  {s.new != null && s.new > 0 && (
                    <Group gap={3} mt={4}>
                      <IconTrendingUp size={11} color="#16a34a" />
                      <Text size="10px" c="#16a34a" fw={600}>+{s.new} за неделю</Text>
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

        {/* Посещаемость */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Card className="admin-insight-card" withBorder radius="lg" p="md">
            <Group gap="sm"><ThemeIcon variant="light" color="cyan" size={34} radius="md"><IconActivity size={17} /></ThemeIcon><Text size="xs" c="gray.5">Посещения за 24 часа</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data?.traffic?.visits24h ?? 0}</Text>
            <Text size="xs" c="gray.4">все просмотры экранов</Text>
          </Card>
          <Card className="admin-insight-card" withBorder radius="lg" p="md">
            <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={34} radius="md"><IconWorld size={17} /></ThemeIcon><Text size="xs" c="gray.5">Уникальные посетители · 7 дней</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data?.traffic?.uniqueVisitors7d ?? 0}</Text>
            <Text size="xs" c="gray.4">по анонимной сессии</Text>
          </Card>
          <Card className="admin-insight-card" withBorder radius="lg" p="md">
            <Group gap="sm"><ThemeIcon variant="light" color="violet" size={34} radius="md"><IconEye size={17} /></ThemeIcon><Text size="xs" c="gray.5">Посещения за 7 дней</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data?.traffic?.visits7d ?? 0}</Text>
            <Text size="xs" c="gray.4">путь пользователя по сайту</Text>
          </Card>
        </SimpleGrid>

        <Card className="admin-insight-card" withBorder radius="lg" p="md">
          <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
            <Group gap="sm">
              <ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconTrendingUp size={18} /></ThemeIcon>
              <Stack gap={1}>
                <Text size="sm" fw={750}>Динамика площадки за 7 дней</Text>
                <Text size="xs" c="dimmed">Только реальные события аналитики и даты создания учётных записей.</Text>
              </Stack>
            </Group>
            <Badge variant="light" color="teal">Регистраций: {dailyTraffic.reduce((sum, point) => sum + point.registrations, 0)}</Badge>
          </Group>
          <Paper withBorder radius="md" p={{ base: "xs", sm: "md" }} bg="gray.0">
            <Group h={170} align="flex-end" gap="xs" wrap="nowrap" role="img" aria-label="График посещений и регистраций за семь дней">
              {dailyTraffic.map((point) => {
                const label = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))
                const visitHeight = Math.max(6, Math.round((point.visits / maxDailyVisits) * 118))
                const registrationHeight = point.registrations ? Math.max(6, Math.round((point.registrations / maxDailyRegistrations) * 118)) : 3
                return (
                  <Stack key={point.date} gap={5} align="center" style={{ flex: 1, minWidth: 0 }}>
                    <Group h={122} gap={3} align="flex-end" wrap="nowrap">
                      <Tooltip label={`${point.visits} посещений`} withArrow><Box h={visitHeight} bg="indigo.5" style={{ width: "clamp(10px, 2vw, 18px)", borderRadius: "6px 6px 2px 2px" }} /></Tooltip>
                      <Tooltip label={`${point.registrations} регистраций`} withArrow><Box h={registrationHeight} bg={point.registrations ? "teal.5" : "gray.3"} style={{ width: "clamp(6px, 1.2vw, 10px)", borderRadius: "5px 5px 2px 2px" }} /></Tooltip>
                    </Group>
                    <Text size="10px" c="dimmed" fw={650} ta="center">{label}</Text>
                  </Stack>
                )
              })}
            </Group>
            <Group gap="md" justify="center" mt="xs"><Badge variant="dot" color="indigo">Посещения</Badge><Badge variant="dot" color="teal">Регистрации</Badge></Group>
          </Paper>

          <SimpleGrid cols={{ base: 2, xs: 4, sm: 7 }} spacing="xs">
            {dailyTraffic.map((point) => {
              const label = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))
              return (
                <Paper key={point.date} withBorder radius="md" p="xs">
                  <Text size="xs" c="dimmed" fw={700}>{label}</Text>
                  <Text size="lg" fw={850} mt={4}>{point.visits}</Text>
                  <Text size="10px" c="dimmed">визитов</Text>
                  <Progress value={(point.visits / maxDailyVisits) * 100} color="indigo" size="sm" radius="xl" mt="xs" aria-label={`${label}: ${point.visits} визитов`} />
                  <Group justify="space-between" gap={4} mt={6}>
                    <Text size="10px" c="dimmed">регистрации</Text>
                    <Badge size="xs" variant="light" color={point.registrations ? "teal" : "gray"}>{point.registrations}</Badge>
                  </Group>
                </Paper>
              )
            })}
          </SimpleGrid>
        </Card>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <Card className="admin-insight-card" withBorder radius="lg" p="md">
            <Text size="sm" fw={600} c="dark.9" mb="sm">Популярные экраны за 7 дней</Text>
            <Stack gap="xs">
              {data.traffic.topPaths.map((item) => (
                <Group key={item.path} justify="space-between"><Text size="xs" c="gray.6" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.path}</Text><Badge size="sm" variant="light" color="indigo">{item.count}</Badge></Group>
              ))}
              {!data.traffic.topPaths.length && <Text size="xs" c="gray.4">Данные появятся после первых визитов.</Text>}
            </Stack>
          </Card>
          <Card className="admin-insight-card" withBorder radius="lg" p="md">
            <Text size="sm" fw={600} c="dark.9" mb="sm">Последние идентифицированные посетители</Text>
            <Stack gap="xs">
              {data.traffic.recentVisitors.slice(0, 6).map((visit) => (
                <Group key={visit.id} justify="space-between"><Text size="xs" c="gray.6">{visit.user?.name || visit.user?.email || "Пользователь"}</Text><Text size="xs" c="gray.4">{new Date(visit.createdAt).toLocaleDateString("ru-RU")}</Text></Group>
              ))}
              {!data.traffic.recentVisitors.length && <Text size="xs" c="gray.4">Пока нет авторизованных визитов.</Text>}
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Распределение по категориям */}
        <Card className="admin-insight-card" withBorder radius="lg" p="md">
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={600} c="dark.9">Объявления по категориям транспорта</Text>
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
          <Card className="admin-insight-card" withBorder radius="lg" p="md">
            <Stack gap="xs">
              <Group gap="sm"><IconFlame size={16} color="#f97316" /><Text size="xs" c="gray.5">Премиум-объявления</Text></Group>
              <Text size="xl" fw={700} c="dark.9">{data?.featured ?? 0}</Text>
              <Text size="xs" c="gray.4">{Math.round(((data?.featured ?? 0) / total) * 100)}% от всех</Text>
            </Stack>
          </Card>
          <Card className="admin-insight-card" withBorder radius="lg" p="md">
            <Stack gap="xs">
              <Group gap="sm"><IconTrendingUp size={16} color="#16a34a" /><Text size="xs" c="gray.5">Средняя цена</Text></Group>
              <Text size="xl" fw={700} c="dark.9">{data?.avgPrice?.toLocaleString("ru-RU") ?? 0} ₽</Text>
              <Text size="xs" c="gray.4">по всем объявлениям</Text>
            </Stack>
          </Card>
          <Card className="admin-insight-card" withBorder radius="lg" p="md">
            <Stack gap="xs">
              <Group gap="sm"><IconUsers size={16} color="#4f46e5" /><Text size="xs" c="gray.5">Роли</Text></Group>
              {Object.entries(data?.byRole || {}).map(([role, count]) => (
                <Group key={role} justify="space-between">
                  <Text size="xs" c="gray.6">{role}</Text>
                  <Text size="xs" fw={600} c="dark.9">{count as number}</Text>
                </Group>
              ))}
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Быстрые действия */}
        <Card className="admin-insight-card" withBorder radius="lg" p="md">
          <Text size="sm" fw={600} c="dark.9" mb="sm">Управление</Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Card className="admin-action-card" component={Link} href="/admin/users" withBorder radius="lg" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconUsers size={16} /></ThemeIcon><Text size="xs" fw={500}>Пользователи</Text></Group>
            </Card>
            <Card className="admin-action-card" component={Link} href="/moderation" withBorder radius="lg" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="blue" size={32} radius="md"><IconCar size={16} /></ThemeIcon><Text size="xs" fw={500}>Объявления</Text></Group>
            </Card>
            <Card className="admin-action-card" component={Link} href="/parts-finder" withBorder radius="lg" p="sm">
              <Group gap="sm"><ThemeIcon variant="light" color="green" size={32} radius="md"><IconTag size={16} /></ThemeIcon><Text size="xs" fw={500}>Запчасти</Text></Group>
            </Card>
            <Card className="admin-action-card" component={Link} href="/messages" withBorder radius="lg" p="sm">
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
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Box>
  )
}
