"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import {
  Box, Stack, Text, Center, Loader, NavLink, Group, Card, Avatar,
  SimpleGrid, ThemeIcon, Button, Badge, Divider, TextInput, Textarea,
  Switch, Title, Container, Select,
} from "@mantine/core"
import {
  IconShoppingCart, IconTag, IconTool, IconSettings, IconHome, IconBell,
  IconMessageCircle2, IconHeart, IconEye, IconStar, IconPlus, IconCheck,
  IconTrendingUp, IconCar, IconWallet, IconShieldCheck, IconUser,
} from "@tabler/icons-react"
import Link from "next/link"
import ListingRow, { ListingRowData } from "@/components/listings/ListingRow"
import { formatPriceShort, formatRelativeDate } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Tab = "buyer" | "seller" | "garage" | "settings"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("buyer")

  const { data: myListings } = useSWR<{ listings: ListingRowData[] }>(
    session ? `/api/listings?userId=${session.user.id}&limit=50` : null, fetcher
  )
  const { data: favorites } = useSWR<{ favorites: ListingRowData[] }>(
    session ? "/api/favorites" : null, fetcher
  )
  const { data: notifs } = useSWR<{ notifications: any[] }>(
    session ? "/api/notifications" : null, fetcher
  )

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.push("/auth/signin")
  }, [session, status, router])

  if (status === "loading" || !session) {
    return <Center py={80}><Loader color="indigo" /></Center>
  }

  const myListingsData = myListings?.listings || []
  const favData = favorites?.favorites || []
  const unread = (notifs?.notifications || []).filter((n) => !n.isRead).length

  return (
    <Box style={{ display: "flex", minHeight: "calc(100vh - 53px)" }}>
      {/* Внутренний сайдбар дашборда */}
      <Box
        component="aside"
        style={{
          width: 220, flexShrink: 0, borderRight: "1px solid #f4f4f5", background: "#fff",
          position: "sticky", top: 53, height: "calc(100vh - 53px)", overflowY: "auto",
        }}
      >
        <Stack gap={0} p="sm">
          {/* Профиль */}
          <Group gap="sm" p="sm" mb="xs">
            <Avatar src={session.user?.image} radius="xl" size={40} color="indigo">
              {session.user?.name?.[0]?.toUpperCase()}
            </Avatar>
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} c="#18181b" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.user?.name || "Пользователь"}
              </Text>
              <Text size="xs" c="#a1a1aa" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.user?.email}
              </Text>
            </Stack>
          </Group>

          <Divider mb="xs" color="#f4f4f5" />

          {/* Разделы */}
          <Text size="10px" fw={700} c="#a1a1aa" px="sm" pb="xs" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Разделы
          </Text>
          <Stack gap={2}>
            {([
              { id: "buyer" as const, label: "Покупатель", icon: <IconShoppingCart size={16} stroke={1.7} /> },
              { id: "seller" as const, label: "Продавец", icon: <IconTag size={16} stroke={1.7} /> },
              { id: "garage" as const, label: "Гараж", icon: <IconTool size={16} stroke={1.7} /> },
              { id: "settings" as const, label: "Настройки", icon: <IconSettings size={16} stroke={1.7} /> },
            ]).map((item) => (
              <NavLink
                key={item.id}
                label={<Text size="sm" fw={tab === item.id ? 600 : 500}>{item.label}</Text>}
                leftSection={item.icon}
                active={tab === item.id}
                onClick={() => setTab(item.id)}
                color="indigo"
                radius="md"
                py={7}
              />
            ))}
          </Stack>

          <Divider my="sm" color="#f4f4f5" />

          <Text size="10px" fw={700} c="#a1a1aa" px="sm" pb="xs" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Переходы
          </Text>
          <Stack gap={2}>
            <NavLink component={Link} href="/" label={<Text size="sm">На главную</Text>} leftSection={<IconHome size={16} stroke={1.7} />} color="gray" radius="md" py={6} />
            <NavLink component={Link} href="/messages" label={<Text size="sm">Сообщения</Text>} leftSection={<IconMessageCircle2 size={16} stroke={1.7} />} color="gray" radius="md" py={6} />
            <NavLink component={Link} href="/notifications" label={<Text size="sm">Уведомления</Text>} leftSection={<IconBell size={16} stroke={1.7} />} color="gray" radius="md" py={6}
              rightSection={unread > 0 ? <Badge color="red" size="xs" circle>{unread}</Badge> : undefined} />
          </Stack>
        </Stack>
      </Box>

      {/* Контент */}
      <Box component="main" style={{ flex: 1, minWidth: 0, padding: "16px 24px" }}>
        {tab === "buyer" && <BuyerTab favorites={favData} loading={!favorites} />}
        {tab === "seller" && <SellerTab listings={myListingsData} loading={!myListings} />}
        {tab === "garage" && <GarageTab />}
        {tab === "settings" && <SettingsTab session={session} />}
      </Box>
    </Box>
  )
}

// ===== ПОКУПАТЕЛЬ =====
function BuyerTab({ favorites, loading }: { favorites: ListingRowData[]; loading: boolean }) {
  return (
    <Stack gap="md">
      <Title order={2} size="h3" ff="var(--font-display),sans-serif">Покупатель</Title>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatBox icon={<IconHeart size={18} />} label="Избранное" value={favorites.length} color="red" />
        <StatBox icon={<IconEye size={18} />} label="Просмотрено" value={0} color="blue" />
        <StatBox icon={<IconMessageCircle2 size={18} />} label="Диалоги" value={0} color="green" />
        <StatBox icon={<IconStar size={18} />} label="Отзывы" value={0} color="orange" />
      </SimpleGrid>
      <Text size="sm" fw={600} c="#18181b" mt="xs">Избранные объявления</Text>
      {loading ? <Center py={40}><Loader size="sm" color="indigo" /></Center>
      : favorites.length === 0 ? (
        <Center py={40}>
          <Stack align="center" gap="sm">
            <IconHeart size={32} stroke={1.5} color="#d4d4d8" />
            <Text size="sm" c="#52525b">Избранное пусто</Text>
            <Button component={Link} href="/" variant="light" color="indigo" size="sm">К объявлениям</Button>
          </Stack>
        </Center>
      ) : (
        <Stack gap="xs">{favorites.map((l) => <ListingRow key={l.id} listing={l} />)}</Stack>
      )}
    </Stack>
  )
}

// ===== ПРОДАВЕЦ =====
function SellerTab({ listings, loading }: { listings: ListingRowData[]; loading: boolean }) {
  const totalViews = listings.reduce((s, l) => s + (l.views || 0), 0)
  const avgPrice = listings.length > 0 ? Math.round(listings.reduce((s, l) => s + (l.price || 0), 0) / listings.length) : 0
  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2} size="h3" ff="var(--font-display),sans-serif">Продавец</Title>
        <Button component={Link} href="/listings/create/vehicle" leftSection={<IconPlus size={16} />} size="sm" color="indigo" radius="md">Разместить</Button>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatBox icon={<IconTag size={18} />} label="Объявлений" value={listings.length} color="indigo" />
        <StatBox icon={<IconEye size={18} />} label="Просмотров" value={totalViews} color="blue" />
        <StatBox icon={<IconTrendingUp size={18} />} label="Средняя цена" value={avgPrice > 0 ? formatPriceShort(avgPrice) : "—"} color="green" />
        <StatBox icon={<IconWallet size={18} />} label="Баланс" value="0 ₽" color="orange" />
      </SimpleGrid>
      <Text size="sm" fw={600} c="#18181b" mt="xs">Мои объявления</Text>
      {loading ? <Center py={40}><Loader size="sm" color="indigo" /></Center>
      : listings.length === 0 ? (
        <Center py={40}>
          <Stack align="center" gap="sm">
            <IconTag size={32} stroke={1.5} color="#d4d4d8" />
            <Text size="sm" c="#52525b">Нет объявлений</Text>
            <Button component={Link} href="/listings/create/vehicle" variant="light" color="indigo" size="sm">Разместить первое</Button>
          </Stack>
        </Center>
      ) : (
        <Stack gap="xs">{listings.map((l) => <ListingRow key={l.id} listing={l} />)}</Stack>
      )}
    </Stack>
  )
}

// ===== ГАРАЖ =====
function GarageTab() {
  const { data, mutate } = useSWR<{ vehicles: any[] }>("/api/garage", fetcher)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ make: "", model: "", year: 2020, mileage: 0, fuelType: "GASOLINE", transmission: "MANUAL", color: "", condition: "EXCELLENT", location: "" })

  const save = async () => {
    if (!form.make || !form.model) return
    setSaving(true)
    try {
      await fetch("/api/garage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      setForm({ make: "", model: "", year: 2020, mileage: 0, fuelType: "GASOLINE", transmission: "MANUAL", color: "", condition: "EXCELLENT", location: "" })
      setShowForm(false)
      mutate()
    } finally { setSaving(false) }
  }

  const vehicles = data?.vehicles || []

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Stack gap={0}>
          <Title order={2} size="h3" ff="var(--font-display),sans-serif">Мой гараж</Title>
          <Text size="xs" c="#71717a">{vehicles.length} авто</Text>
        </Stack>
        <Button leftSection={<IconPlus size={16} />} size="sm" color="indigo" radius="md" variant="light" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Отмена" : "Добавить авто"}
        </Button>
      </Group>

      {/* Форма добавления */}
      {showForm && (
        <Card withBorder radius="md" p="md" style={{ borderColor: "#c7d2fe", background: "#fafafa" }}>
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput label="Марка" placeholder="BMW, Toyota..." value={form.make} onChange={(e) => setForm({ ...form, make: e.currentTarget.value })} size="sm" radius="md" />
              <TextInput label="Модель" placeholder="X5, Camry..." value={form.model} onChange={(e) => setForm({ ...form, model: e.currentTarget.value })} size="sm" radius="md" />
              <TextInput label="Год" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.currentTarget.value) || 2020 })} size="sm" radius="md" />
              <TextInput label="Пробег, км" type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: parseInt(e.currentTarget.value) || 0 })} size="sm" radius="md" />
              <Select label="Топливо" data={[{ value: "GASOLINE", label: "Бензин" }, { value: "DIESEL", label: "Дизель" }, { value: "ELECTRIC", label: "Электро" }, { value: "HYBRID", label: "Гибрид" }]} value={form.fuelType} onChange={(v) => setForm({ ...form, fuelType: v || "GASOLINE" })} size="sm" radius="md" />
              <Select label="Коробка" data={[{ value: "MANUAL", label: "Механика" }, { value: "AUTOMATIC", label: "Автомат" }, { value: "VARIATOR", label: "Вариатор" }]} value={form.transmission} onChange={(v) => setForm({ ...form, transmission: v || "MANUAL" })} size="sm" radius="md" />
              <TextInput label="Цвет" placeholder="Чёрный" value={form.color} onChange={(e) => setForm({ ...form, color: e.currentTarget.value })} size="sm" radius="md" />
              <TextInput label="Город" placeholder="Москва" value={form.location} onChange={(e) => setForm({ ...form, location: e.currentTarget.value })} size="sm" radius="md" />
            </SimpleGrid>
            <Button onClick={save} loading={saving} color="indigo" size="sm" radius="md">Сохранить в гараж</Button>
          </Stack>
        </Card>
      )}

      {/* Список авто */}
      {!data ? (
        <Center py={40}><Loader size="sm" color="indigo" /></Center>
      ) : vehicles.length === 0 ? (
        <Card withBorder radius="md" p="xl" style={{ borderColor: "#f4f4f5" }}>
          <Center>
            <Stack align="center" gap="md">
              <ThemeIcon variant="light" color="indigo" size={56} radius="xl"><IconCar size={28} /></ThemeIcon>
              <Stack gap={4} align="center">
                <Text fw={500} c="#52525b">В гараже пусто</Text>
                <Text size="xs" c="#a1a1aa">Добавьте авто для сервисной книжки, оценки стоимости, истории расходов</Text>
              </Stack>
              <Button variant="filled" color="indigo" mt="xs" size="sm" onClick={() => setShowForm(true)}>Добавить автомобиль</Button>
            </Stack>
          </Center>
        </Card>
      ) : (
        <Stack gap="xs">
          {vehicles.map((v) => (
            <Card key={v.id} withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5" }}>
              <Group gap="sm" align="center" justify="space-between">
                <Group gap="sm">
                  <ThemeIcon variant="light" color="indigo" size={40} radius="md"><IconCar size={20} /></ThemeIcon>
                  <Stack gap={0}>
                    <Text size="sm" fw={600} c="#18181b">{v.year} {v.make} {v.model}</Text>
                    <Text size="xs" c="#71717a">
                      {v.mileage?.toLocaleString("ru-RU")} км · {v.fuelType === "ELECTRIC" ? "Электро" : v.fuelType} · {v.color || "—"}
                    </Text>
                  </Stack>
                </Group>
                <Badge variant="light" color="gray" size="sm">{v.condition}</Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

// ===== НАСТРОЙКИ =====
function SettingsTab({ session }: { session: any }) {
  return (
    <Stack gap="md">
      <Title order={2} size="h3" ff="var(--font-display),sans-serif">Настройки профиля</Title>
      <Card withBorder radius="md" p="lg" style={{ borderColor: "#f4f4f5" }}>
        <Stack gap="md">
          <Group gap="md" align="center">
            <Avatar src={session.user?.image} radius="xl" size={56} color="indigo">{session.user?.name?.[0]?.toUpperCase()}</Avatar>
            <Stack gap={4}>
              <Group gap={6}>
                <Badge variant="light" color="green" size="sm" leftSection={<IconShieldCheck size={11} />}>Верифицирован</Badge>
                <Badge variant="light" color="indigo" size="sm">{session.user?.role || "USER"}</Badge>
              </Group>
              <Text size="xs" c="#a1a1aa">На Авторынке с {formatRelativeDate(session.user?.createdAt || new Date())}</Text>
            </Stack>
          </Group>
          <Divider color="#f4f4f5" />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput label="Имя" defaultValue={session.user?.name || ""} radius="md" size="sm" />
            <TextInput label="Email" defaultValue={session.user?.email || ""} radius="md" size="sm" disabled />
            <TextInput label="Телефон" placeholder="+7 (___) ___-__-__" radius="md" size="sm" />
            <TextInput label="Город" placeholder="Москва" radius="md" size="sm" />
          </SimpleGrid>
          <Textarea label="О себе" placeholder="Расскажите о себе..." minRows={3} radius="md" size="sm" />
          <Divider label="Уведомления" labelPosition="center" color="#f4f4f5" />
          <Group justify="space-between"><Text size="sm">Email-уведомления</Text><Switch defaultChecked color="indigo" /></Group>
          <Group justify="space-between"><Text size="sm">Push-уведомления</Text><Switch defaultChecked color="indigo" /></Group>
          <Group justify="space-between"><Text size="sm">Новые объявления по подписке</Text><Switch color="indigo" /></Group>
          <Group justify="flex-end"><Button variant="default" size="sm" radius="md">Отмена</Button><Button variant="filled" color="indigo" size="sm" radius="md">Сохранить</Button></Group>
        </Stack>
      </Card>
    </Stack>
  )
}

function StatBox({ icon, label, value, color = "indigo" }: { icon: React.ReactNode; label: string; value: number | string; color?: string }) {
  return (
    <Card withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5" }}>
      <Group gap="sm" align="center">
        <ThemeIcon variant="light" color={color} size={36} radius="md">{icon}</ThemeIcon>
        <Stack gap={0}>
          <Text size="lg" fw={700} c="#18181b" ff="var(--font-display),sans-serif" lh={1.1}>{value}</Text>
          <Text size="xs" c="#71717a">{label}</Text>
        </Stack>
      </Group>
    </Card>
  )
}
