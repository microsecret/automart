"use client"
export const dynamic = "force-dynamic"


import useSWR from "swr"
import { Box, Stack, Text, Center, Loader, SimpleGrid, Card, ThemeIcon, Title, Group, Badge, Progress, Button } from "@mantine/core"
import { IconUsers, IconCar, IconTag, IconMessageCircle2, IconStar, IconBell, IconEye, IconFlame, IconTrendingUp, IconRobot, IconActivity, IconWorld } from "@tabler/icons-react"
import Link from "next/link"
import ListingModerationPanel from "@/components/moderation/ListingModerationPanel"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  CAR: "Легковые", MOTORCYCLE: "Мото", TRUCK: "Грузовики", SPECIAL: "Спецтехника", WATER: "Водный", AIR: "Авиа",
}

export default function AdminDashboard() {
  const { data, isLoading } = useSWR<any>("/api/admin/stats", fetcher)

  if (isLoading) return <Center py={80}><Loader color="indigo" /></Center>

  const c = data?.counts || {}
  const stats = [
    { label: "Пользователи", value: c.users ?? 0, icon: <IconUsers size={18} />, color: "indigo", href: "/admin/users", new: data?.recent?.newUsers },
    { label: "Объявления", value: c.listings ?? 0, icon: <IconTag size={18} />, color: "blue", new: data?.recent?.newListings },
    { label: "Транспорт", value: c.vehicles ?? 0, icon: <IconCar size={18} />, color: "teal" },
    { label: "Запчасти", value: c.parts ?? 0, icon: <IconCar size={18} />, color: "green" },
    { label: "Сообщения", value: c.messages ?? 0, icon: <IconMessageCircle2 size={18} />, color: "cyan" },
    { label: "Отзывы", value: c.reviews ?? 0, icon: <IconStar size={18} />, color: "orange" },
    { label: "Уведомления", value: c.notifications ?? 0, icon: <IconBell size={18} />, color: "red" },
    { label: "AI-запросы", value: c.aiLogs ?? 0, icon: <IconRobot size={18} />, color: "violet" },
  ]

  const total = c.listings || 1

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
              <Button component={Link} href="/admin/users" variant="white" color="dark" size="sm">Пользователи</Button>
              <Button component={Link} href="/moderation" variant="outline" color="gray" size="sm" styles={{ root: { color: "white", borderColor: "rgba(255,255,255,.48)" } }}>Очередь</Button>
            </Group>
          </Group>
        </Card>

        <Group className="admin-workspace__nav" gap={6} wrap="wrap">
          <Button component={Link} href="/admin" variant="light" color="indigo" size="xs">Обзор</Button>
          <Button component={Link} href="/admin/users" variant="subtle" color="gray" size="xs">Пользователи</Button>
          <Button component={Link} href="/moderation" variant="subtle" color="gray" size="xs">Модерация</Button>
          <Button component={Link} href="/admin/auctions" variant="subtle" color="gray" size="xs">Аукционы</Button>
        </Group>

        {/* Основные метрики */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {stats.map((s) => (
            <Card className="admin-metric-card" key={s.label} withBorder radius="lg" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}
              component={(s.href ? Link : "div") as any} href={s.href || undefined}>
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
          ))}
        </SimpleGrid>

        {/* Посещаемость */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
            <Group gap="sm"><ThemeIcon variant="light" color="cyan" size={34} radius="md"><IconActivity size={17} /></ThemeIcon><Text size="xs" c="gray.5">Посещения за 24 часа</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data?.traffic?.visits24h ?? 0}</Text>
            <Text size="xs" c="gray.4">все просмотры экранов</Text>
          </Card>
          <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
            <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={34} radius="md"><IconWorld size={17} /></ThemeIcon><Text size="xs" c="gray.5">Уникальные посетители · 7 дней</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data?.traffic?.uniqueVisitors7d ?? 0}</Text>
            <Text size="xs" c="gray.4">по анонимной сессии</Text>
          </Card>
          <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
            <Group gap="sm"><ThemeIcon variant="light" color="violet" size={34} radius="md"><IconEye size={17} /></ThemeIcon><Text size="xs" c="gray.5">Посещения за 7 дней</Text></Group>
            <Text size="xl" fw={800} mt="sm">{data?.traffic?.visits7d ?? 0}</Text>
            <Text size="xs" c="gray.4">путь пользователя по сайту</Text>
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
            <Text size="sm" fw={600} c="dark.9" mb="sm">Популярные экраны за 7 дней</Text>
            <Stack gap="xs">
              {(data?.traffic?.topPaths || []).map((item: { path: string; count: number }) => (
                <Group key={item.path} justify="space-between"><Text size="xs" c="gray.6" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.path}</Text><Badge size="sm" variant="light" color="indigo">{item.count}</Badge></Group>
              ))}
              {!data?.traffic?.topPaths?.length && <Text size="xs" c="gray.4">Данные появятся после первых визитов.</Text>}
            </Stack>
          </Card>
          <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
            <Text size="sm" fw={600} c="dark.9" mb="sm">Последние идентифицированные посетители</Text>
            <Stack gap="xs">
              {(data?.traffic?.recentVisitors || []).slice(0, 6).map((visit: any) => (
                <Group key={visit.id} justify="space-between"><Text size="xs" c="gray.6">{visit.user?.name || visit.user?.email || "Пользователь"}</Text><Text size="xs" c="gray.4">{new Date(visit.createdAt).toLocaleDateString("ru-RU")}</Text></Group>
              ))}
              {!data?.traffic?.recentVisitors?.length && <Text size="xs" c="gray.4">Пока нет авторизованных визитов.</Text>}
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Распределение по категориям */}
        <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
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
          <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
            <Stack gap="xs">
              <Group gap="sm"><IconFlame size={16} color="#f97316" /><Text size="xs" c="gray.5">Премиум-объявления</Text></Group>
              <Text size="xl" fw={700} c="dark.9">{data?.featured ?? 0}</Text>
              <Text size="xs" c="gray.4">{Math.round(((data?.featured ?? 0) / total) * 100)}% от всех</Text>
            </Stack>
          </Card>
          <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
            <Stack gap="xs">
              <Group gap="sm"><IconTrendingUp size={16} color="#16a34a" /><Text size="xs" c="gray.5">Средняя цена</Text></Group>
              <Text size="xl" fw={700} c="dark.9">{data?.avgPrice?.toLocaleString("ru-RU") ?? 0} ₽</Text>
              <Text size="xs" c="gray.4">по всем объявлениям</Text>
            </Stack>
          </Card>
          <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
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
        <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
          <Text size="sm" fw={600} c="dark.9" mb="sm">Управление</Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Card component={Link} href="/admin/users" withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconUsers size={16} /></ThemeIcon><Text size="xs" fw={500}>Пользователи</Text></Group>
            </Card>
            <Card component={Link} href="/category/cars" withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm"><ThemeIcon variant="light" color="blue" size={32} radius="md"><IconCar size={16} /></ThemeIcon><Text size="xs" fw={500}>Объявления</Text></Group>
            </Card>
            <Card component={Link} href="/category/parts" withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm"><ThemeIcon variant="light" color="green" size={32} radius="md"><IconTag size={16} /></ThemeIcon><Text size="xs" fw={500}>Запчасти</Text></Group>
            </Card>
            <Card component={Link} href="/messages" withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm"><ThemeIcon variant="light" color="cyan" size={32} radius="md"><IconMessageCircle2 size={16} /></ThemeIcon><Text size="xs" fw={500}>Сообщения</Text></Group>
            </Card>
          </SimpleGrid>
        </Card>
        {/* Модерация объявлений */}
        <ListingModerationPanel />
      </Stack>
    </Box>
  )
}
