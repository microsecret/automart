"use client"

import { Avatar, Box, Button, Group, NavLink, Paper, ScrollArea, Stack, Text, ThemeIcon } from "@mantine/core"
import { useSession } from "next-auth/react"
import {
  IconCar, IconHeart, IconHome2, IconMessageCircle2, IconMotorbike, IconPlane,
  IconPlus, IconSearch, IconSpeedboat, IconTools, IconTractor, IconTruck,
  IconTruckDelivery, IconUserCircle, IconGavel, IconNews, IconShieldCheck,
} from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import AppAnalytics from "@/components/analytics/AppAnalytics"
import SupportChat from "@/components/support/SupportChat"
import AppFooter from "./AppFooter"
import AppHeader from "./AppHeader"

const TRANSPORT = [
  { slug: "cars", label: "Легковые", icon: <IconCar size={16} stroke={1.8} /> },
  { slug: "moto", label: "Мото", icon: <IconMotorbike size={16} stroke={1.8} /> },
  { slug: "trucks", label: "Грузовики", icon: <IconTruck size={16} stroke={1.8} /> },
  { slug: "special", label: "Спецтехника", icon: <IconTractor size={16} stroke={1.8} /> },
  { slug: "water", label: "Водный транспорт", icon: <IconSpeedboat size={16} stroke={1.8} /> },
  { slug: "air", label: "Воздушный транспорт", icon: <IconPlane size={16} stroke={1.8} /> },
]

const PARTS = [
  { label: "Все запчасти", href: "/parts-finder", icon: <IconTools size={16} stroke={1.8} /> },
  { label: "Двигатель", href: "/parts-finder?partType=ENGINE" },
  { label: "Тормоза", href: "/parts-finder?partType=BRAKES" },
  { label: "Подвеска и ходовая", href: "/parts-finder?partType=SUSPENSION" },
  { label: "Электрика", href: "/parts-finder?partType=ELECTRICAL" },
  { label: "Оптика", href: "/parts-finder?partType=LIGHTING" },
]

const AUCTIONS = [
  { label: "Все аукционы", href: "/auctions" },
  { label: "Япония", href: "/auctions?country=JP" },
  { label: "Корея", href: "/auctions?country=KR" },
  { label: "Китай", href: "/auctions?country=CN" },
]

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAuthRoute = pathname?.startsWith("/auth/")
  const activeCategory = pathname?.startsWith("/category/") ? pathname.split("/")[2] : null
  const isPartsRoute = pathname?.startsWith("/parts-finder") || activeCategory === "parts"
  const isAuctionsRoute = pathname?.startsWith("/auctions")

  if (isAuthRoute) {
    return (
      <Box component="main" style={{ minHeight: "100vh", background: "var(--market-background)" }}>
        <AppAnalytics />
        {children}
      </Box>
    )
  }

  return (
    <Box style={{ minHeight: "100vh", background: "var(--market-background)" }}>
      <AppAnalytics />
      <AppHeader />

      <Box className="market-shell">
        <Box component="aside" className="app-sidebar">
          <ScrollArea h="100%" type="hover" scrollbarSize={5}>
            <Stack gap="sm" p="sm">
              {/* Для гостя вход уже доступен в хедере: не дублируем две одинаковые пары кнопок. */}
              {session?.user && <AccountPanel session={session} />}

              <SidebarPanel title="Транспорт" icon={<IconCar size={15} />}>
                {TRANSPORT.map((item) => (
                  <NavLink
                    key={item.slug}
                    component={Link}
                    href={`/category/${item.slug}`}
                    label={item.label}
                    leftSection={item.icon}
                    active={activeCategory === item.slug}
                    color="indigo"
                    className="market-side-nav"
                  />
                ))}
              </SidebarPanel>

              {!isPartsRoute && (
                <SidebarPanel title="Запчасти" icon={<IconTools size={15} />}>
                  {PARTS.map((item, index) => (
                    <NavLink
                      key={item.href}
                      component={Link}
                      href={item.href}
                      label={item.label}
                      leftSection={index === 0 ? item.icon : undefined}
                      active={index === 0 && isPartsRoute}
                      color="indigo"
                      className={`market-side-nav ${index > 0 ? "market-side-nav--nested" : ""}`}
                    />
                  ))}
                </SidebarPanel>
              )}

              {!isAuctionsRoute && (
                <SidebarPanel title="Мировые аукционы" icon={<IconGavel size={15} />}>
                  {AUCTIONS.map((item, index) => (
                    <NavLink
                      key={item.href}
                      component={Link}
                      href={item.href}
                      label={item.label}
                      leftSection={index === 0 ? <IconGavel size={16} stroke={1.8} /> : undefined}
                      active={pathname === "/auctions" && index === 0}
                      color="orange"
                      className={`market-side-nav ${index > 0 ? "market-side-nav--nested" : ""}`}
                    />
                  ))}
                </SidebarPanel>
              )}

              <Paper className="market-side-service" radius="lg" p="sm" withBorder>
                <Group gap="xs" wrap="nowrap" align="flex-start">
                  <ThemeIcon variant="light" color="indigo" radius="md" size={30}><IconShieldCheck size={17} /></ThemeIcon>
                  <Box>
                    <Text size="xs" fw={700}>Безопасная сделка</Text>
                    <Text size="10px" c="dimmed">Проверка, документы и доставка</Text>
                  </Box>
                </Group>
                <Button component={Link} href="/services/safe-deal" variant="subtle" color="indigo" size="compact-sm" mt={6}>Как это работает →</Button>
              </Paper>

              <Group justify="space-between" px={4} pt={2}>
                <Button component={Link} href="/news" variant="subtle" color="gray" size="compact-xs" leftSection={<IconNews size={14} />}>Новости</Button>
                <Button component={Link} href="/help/safety" variant="subtle" color="gray" size="compact-xs">Помощь</Button>
              </Group>
            </Stack>
          </ScrollArea>
        </Box>

        <Box component="main" className="app-main-content">{children}</Box>
      </Box>

      <AppFooter />
      <SupportChat />

      <nav className="mobile-bottom-nav" aria-label="Основная навигация">
        <Link href="/" aria-label="Главная"><IconHome2 size={18} /><span>Главная</span></Link>
        <Link href="/search" aria-label="Поиск"><IconSearch size={18} /><span>Поиск</span></Link>
        <Link href="/listings/create/vehicle" aria-label="Разместить объявление" className="mobile-bottom-nav__accent"><IconPlus size={20} /><span>Продать</span></Link>
        <Link href="/favorites" aria-label="Избранное"><IconHeart size={18} /><span>Избранное</span></Link>
        <Link href="/messages" aria-label="Сообщения"><IconMessageCircle2 size={18} /><span>Чаты</span></Link>
      </nav>
    </Box>
  )
}

function AccountPanel({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  if (session?.user) {
    return (
      <Paper className="market-side-account market-side-account--user" radius="lg" p="sm" withBorder>
        <Group wrap="nowrap" gap="sm">
          <Avatar src={session.user.image} color="indigo" radius="xl" size={34}>{session.user.name?.[0]?.toUpperCase()}</Avatar>
          <Box style={{ minWidth: 0 }}>
            <Text size="xs" c="dimmed">Личный кабинет</Text>
            <Text size="sm" fw={700} lineClamp={1}>{session.user.name || session.user.email}</Text>
          </Box>
        </Group>
        <Group grow mt="sm">
          <Button component={Link} href="/dashboard" variant="filled" color="indigo" size="xs">Кабинет</Button>
          <Button component={Link} href="/dashboard/deliveries" variant="light" color="indigo" size="xs" leftSection={<IconTruckDelivery size={14} />}>Доставки</Button>
        </Group>
      </Paper>
    )
  }

  return null
}

function SidebarPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Paper className="market-side-panel" radius="lg" p={6} withBorder>
      <Group gap={6} px={6} py={4}><ThemeIcon variant="light" color="indigo" size={22} radius="md">{icon}</ThemeIcon><Text size="10px" fw={800} tt="uppercase" c="dimmed">{title}</Text></Group>
      <Stack gap={1} mt={2}>{children}</Stack>
    </Paper>
  )
}
