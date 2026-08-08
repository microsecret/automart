"use client"
export const dynamic = "force-dynamic"


import useSWR from "swr"
import { Box, Stack, Text, Center, Loader, SimpleGrid, Card, ThemeIcon, Title, Group, Badge, Table, Progress, Divider } from "@mantine/core"
import { IconUsers, IconCar, IconTag, IconMessageCircle2, IconStar, IconBell, IconEye, IconFlame, IconTrendingUp, IconRobot, IconCheck } from "@tabler/icons-react"
import Link from "next/link"

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
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Title order={2} size="h3" ff="var(--font-display),sans-serif">Дашборд</Title>
            <Text size="xs" c="#71717a">Обзор платформы в реальном времени</Text>
          </Stack>
          <Badge variant="light" color="red" size="md" leftSection={<IconCheck size={12} />}>ADMIN</Badge>
        </Group>

        {/* Основные метрики */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {stats.map((s) => (
            <Card key={s.label} withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5" }}
              component={s.href ? Link : "div"} href={s.href || undefined}>
              <Group gap="sm" align="flex-start" justify="space-between">
                <Stack gap={0}>
                  <Text size="xl" fw={800} c="#18181b" ff="var(--font-display),sans-serif" lh={1}>{s.value}</Text>
                  <Text size="xs" c="#71717a" mt={2}>{s.label}</Text>
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

        {/* Распределение по категориям */}
        <Card withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={600} c="#18181b">Объявления по категориям транспорта</Text>
            <Badge variant="light" color="indigo" size="sm">{c.listings} всего</Badge>
          </Group>
          <Stack gap="xs">
            {Object.entries(data?.byVehicleType || {}).map(([type, count]) => {
              const pct = Math.round(((count as number) / (c.vehicles || 1)) * 100)
              return (
                <Group gap="sm" key={type}>
                  <Text size="xs" c="#52525b" style={{ width: 90, flexShrink: 0 }}>{VEHICLE_TYPE_LABELS[type] || type}</Text>
                  <Progress value={pct} size="sm" radius="sm" style={{ flex: 1 }} color="indigo" />
                  <Text size="xs" c="#71717a" style={{ width: 40, flexShrink: 0, textAlign: "right" }}>{count as number}</Text>
                </Group>
              )
            })}
          </Stack>
        </Card>

        {/* Доп. статистика */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Card withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
            <Stack gap="xs">
              <Group gap="sm"><IconFlame size={16} color="#f97316" /><Text size="xs" c="#71717a">Премиум-объявления</Text></Group>
              <Text size="xl" fw={700} c="#18181b">{data?.featured ?? 0}</Text>
              <Text size="xs" c="#a1a1aa">{Math.round(((data?.featured ?? 0) / total) * 100)}% от всех</Text>
            </Stack>
          </Card>
          <Card withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
            <Stack gap="xs">
              <Group gap="sm"><IconTrendingUp size={16} color="#16a34a" /><Text size="xs" c="#71717a">Средняя цена</Text></Group>
              <Text size="xl" fw={700} c="#18181b">{data?.avgPrice?.toLocaleString("ru-RU") ?? 0} ₽</Text>
              <Text size="xs" c="#a1a1aa">по всем объявлениям</Text>
            </Stack>
          </Card>
          <Card withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
            <Stack gap="xs">
              <Group gap="sm"><IconUsers size={16} color="#4f46e5" /><Text size="xs" c="#71717a">Роли</Text></Group>
              {Object.entries(data?.byRole || {}).map(([role, count]) => (
                <Group key={role} justify="space-between">
                  <Text size="xs" c="#52525b">{role}</Text>
                  <Text size="xs" fw={600} c="#18181b">{count as number}</Text>
                </Group>
              ))}
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Быстрые действия */}
        <Card withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
          <Text size="sm" fw={600} c="#18181b" mb="sm">Управление</Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Card component={Link} href="/admin/users" withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5" }}>
              <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconUsers size={16} /></ThemeIcon><Text size="xs" fw={500}>Пользователи</Text></Group>
            </Card>
            <Card component={Link} href="/category/cars" withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5" }}>
              <Group gap="sm"><ThemeIcon variant="light" color="blue" size={32} radius="md"><IconCar size={16} /></ThemeIcon><Text size="xs" fw={500}>Объявления</Text></Group>
            </Card>
            <Card component={Link} href="/category/parts" withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5" }}>
              <Group gap="sm"><ThemeIcon variant="light" color="green" size={32} radius="md"><IconTag size={16} /></ThemeIcon><Text size="xs" fw={500}>Запчасти</Text></Group>
            </Card>
            <Card component={Link} href="/messages" withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5" }}>
              <Group gap="sm"><ThemeIcon variant="light" color="cyan" size={32} radius="md"><IconMessageCircle2 size={16} /></ThemeIcon><Text size="xs" fw={500}>Сообщения</Text></Group>
            </Card>
          </SimpleGrid>
        </Card>
      </Stack>
    </Box>
  )
}
