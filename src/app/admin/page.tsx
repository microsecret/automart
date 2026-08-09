"use client"
export const dynamic = "force-dynamic"


import useSWR from "swr"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { Box, Stack, Text, Center, Loader, SimpleGrid, Card, ThemeIcon, Title, Group, Badge, Table, Progress, Divider, Button } from "@mantine/core"
import { IconUsers, IconCar, IconTag, IconMessageCircle2, IconStar, IconBell, IconEye, IconFlame, IconTrendingUp, IconRobot, IconCheck, IconActivity, IconWorld, IconArchive, IconX } from "@tabler/icons-react"
import Link from "next/link"
import { LISTING_STATUS, LISTING_STATUS_META } from "@/lib/listing-lifecycle"

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
            <Text size="xs" c="gray.5">Обзор платформы в реальном времени</Text>
          </Stack>
          <Badge variant="light" color="red" size="md" leftSection={<IconCheck size={12} />}>ADMIN</Badge>
        </Group>

        {/* Основные метрики */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {stats.map((s) => (
            <Card key={s.label} withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}
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
        <ModerationSection />
      </Stack>
    </Box>
  )
}

function ModerationSection() {
  const { data, isLoading, mutate } = useSWR<any>("/api/admin/listings", fetcher)
  const listings = data?.listings || []
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleStatus = async (id: string, status: typeof LISTING_STATUS[keyof typeof LISTING_STATUS]) => {
    const reason = status === LISTING_STATUS.REJECTED
      ? window.prompt("Укажите причину отклонения для владельца")?.trim()
      : undefined
    if (status === LISTING_STATUS.REJECTED && !reason) return

    setUpdatingId(id)
    try {
      const response = await fetch("/api/admin/listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, reason }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось обновить статус")
      notifications.show({ title: "Статус обновлён", message: "Решение сохранено в журнале модерации.", color: "green" })
      await mutate()
    } catch (error) {
      notifications.show({ title: "Ошибка модерации", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Снять объявление с публикации? Оно останется в журнале.")) return
    setUpdatingId(id)
    try {
      const response = await fetch(`/api/admin/listings?id=${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось снять объявление")
      notifications.show({ title: "Снято с публикации", message: "Объявление сохранено в архиве", color: "green" })
      await mutate()
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
          <Badge size="sm" variant="light" color="gray">{listings.length}</Badge>
        </Group>
        {isLoading ? <Center py={20}><Loader size="sm" color="indigo" /></Center> : (
          <Stack gap="xs" style={{ maxHeight: 400, overflow: "auto" }}>
            {listings.filter((l: any) => !l.deletedAt).slice(0, 20).map((l: any) => {
              const statusMeta = LISTING_STATUS_META[l.status as keyof typeof LISTING_STATUS_META] || LISTING_STATUS_META[LISTING_STATUS.DRAFT]
              const isPending = l.status === LISTING_STATUS.PENDING_MODERATION
              return (
              <Group key={l.id} gap="sm" align="center" justify="space-between" p="xs" style={{ background: "var(--mantine-color-gray-0)", borderRadius: 8 }}>
                <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                  <IconTag size={16} color="#71717a" />
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} c="dark.9" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</Text>
                    <Group gap={6}><Text size="xs" c="gray.5">{l.user?.name || l.user?.email} · {l.vehicle ? `${l.vehicle.make} ${l.vehicle.model}` : l.part?.name}</Text><Badge size="xs" color={statusMeta.color} variant="light">{statusMeta.label}</Badge></Group>
                  </Stack>
                </Group>
                <Group gap="xs">
                  <Text size="xs" fw={700} c="dark.9">{(l.price || 0).toLocaleString("ru")}₽</Text>
                  <Link href={l.vehicle ? `/listings/vehicle/${l.vehicle.id}` : `/listings/part/${l.part?.id}`} target="_blank">
                    <Badge size="xs" variant="light" color="indigo">Открыть</Badge>
                  </Link>
                  {isPending && <Button size="xs" variant="light" color="green" loading={updatingId === l.id} onClick={() => handleStatus(l.id, LISTING_STATUS.ACTIVE)} leftSection={<IconCheck size={12} />}>Одобрить</Button>}
                  {isPending && <Button size="xs" variant="light" color="red" loading={updatingId === l.id} onClick={() => handleStatus(l.id, LISTING_STATUS.REJECTED)} leftSection={<IconX size={12} />}>Отклонить</Button>}
                  {!isPending && l.status !== LISTING_STATUS.ARCHIVED && <Button size="xs" variant="subtle" color="gray" loading={updatingId === l.id} onClick={() => handleStatus(l.id, LISTING_STATUS.ARCHIVED)} leftSection={<IconArchive size={12} />}>В архив</Button>}
                  <Button size="xs" variant="subtle" color="red" loading={updatingId === l.id} onClick={() => handleDelete(l.id)}>Снять</Button>
                </Group>
              </Group>
            )})}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
