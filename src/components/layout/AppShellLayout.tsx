"use client"

import { AppShell, Avatar, Badge, Box, Button, Divider, Group, NavLink, Paper, ScrollArea, Stack, Text, ThemeIcon } from "@mantine/core"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import {
  IconBell, IconBrain, IconCar, IconChartBar, IconFileDescription, IconFileSearch, IconGasStation,
  IconGavel, IconHeart, IconHome2, IconLayoutDashboard, IconMessageCircle2, IconMotorbike, IconNews,
  IconPlane, IconPlus, IconSearch, IconSettings, IconShieldCheck, IconSpeedboat, IconTools,
  IconTractor, IconTruck, IconTruckDelivery,
} from "@tabler/icons-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { useDisclosure } from "@mantine/hooks"
import AppAnalytics from "@/components/analytics/AppAnalytics"
import SupportChat from "@/components/support/SupportChat"
import { fetchJson } from "@/lib/api-client"
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
  { label: "Двигатель", href: "/parts-finder?partType=ENGINE" },
  { label: "Тормоза", href: "/parts-finder?partType=BRAKES" },
  { label: "Подвеска и ходовая", href: "/parts-finder?partType=SUSPENSION" },
  { label: "Электрика", href: "/parts-finder?partType=ELECTRICAL" },
  { label: "Оптика", href: "/parts-finder?partType=LIGHTING" },
]

const AUCTIONS = [
  { label: "Япония", href: "/auctions?country=JP" },
  { label: "Корея", href: "/auctions?country=KR" },
  { label: "Китай", href: "/auctions?country=CN" },
  { label: "США", href: "/auctions?country=US" },
  { label: "Европа", href: "/auctions?country=DE" },
]

const SERVICES = [
  { label: "Карта АЗС", href: "/services/fuel-map", icon: <IconGasStation size={16} stroke={1.8} />, color: "orange" },
  { label: "Проверка истории", href: "/services/history-check", icon: <IconFileSearch size={16} stroke={1.8} />, color: "cyan" },
  { label: "Оценка стоимости", href: "/services/valuation", icon: <IconChartBar size={16} stroke={1.8} />, color: "indigo" },
  { label: "Умный подбор", href: "/services/smart-matching", icon: <IconBrain size={16} stroke={1.8} />, color: "violet" },
  { label: "Безопасная сделка", href: "/services/safe-deal", icon: <IconShieldCheck size={16} stroke={1.8} />, color: "teal" },
  { label: "Документы сделки", href: "/services/legal-documents", icon: <IconFileDescription size={16} stroke={1.8} />, color: "grape" },
]

const MOBILE_NAV = [
  { href: "/", label: "Главная", Icon: IconHome2 },
  { href: "/search", label: "Поиск", Icon: IconSearch },
  { href: "/listings/create/vehicle", label: "Подать", Icon: IconPlus, accent: true },
  { href: "/favorites", label: "Избранное", Icon: IconHeart },
  { href: "/messages", label: "Чаты", Icon: IconMessageCircle2 },
]

type AccountSummary = {
  stats: {
    totalListings: number
    favoritesCount: number
    garageCount: number
    activeDeliveries: number
    unreadMessages: number
    unreadNotifications: number
  }
  workflow: {
    pendingModeration: number
    needsAttention: number
  }
}

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpened, { close: closeMobile, toggle: toggleMobile }] = useDisclosure(false)
  const isAuthRoute = pathname?.startsWith("/auth/")
  // Telegram Web Apps should open as a focused, full-screen experience. Rendering
  // the desktop shell around it wastes the mobile viewport and duplicates navigation.
  const isStandaloneRoute = isAuthRoute || pathname?.startsWith("/telegram")
  const activeCategory = pathname?.startsWith("/category/") ? pathname.split("/")[2] : null
  const isMobileNavActive = (href: string) => href === "/" ? pathname === "/" : pathname?.startsWith(href)

  useEffect(() => {
    closeMobile()
  }, [pathname, closeMobile])

  if (isStandaloneRoute) {
    return (
      <Box component="main" style={{ minHeight: "100vh", background: "var(--market-background)" }}>
        <AppAnalytics />
        {children}
        {isAuthRoute && <SupportChat />}
      </Box>
    )
  }

  return (
    <AppShell
      header={{ height: 68 }}
      navbar={{ width: 280, breakpoint: "md", collapsed: { mobile: !mobileOpened } }}
      padding={0}
      style={{ minHeight: "100vh", background: "var(--market-background)" }}
    >
      <AppAnalytics />
      <Suspense fallback={null}>
        <NavigationQuerySync onRouteChange={closeMobile} />
      </Suspense>
      <AppShell.Header>
        <AppHeader navigationOpened={mobileOpened} onNavigationToggle={toggleMobile} />
      </AppShell.Header>

      <AppShell.Navbar className="market-app-navbar" p={0} style={{ background: "var(--market-surface-subtle)", borderRight: "1px solid var(--market-line)" }}>
        <AppShell.Section grow component={ScrollArea} type="hover" scrollbarSize={5}>
          <Stack gap="sm" p="sm">
              {/* Для гостя вход уже доступен в хедере: не дублируем две одинаковые пары кнопок. */}
              {session?.user && (
                <Suspense fallback={<AccountPanel pathname={pathname || ""} dashboardTab="listings" session={session} />}>
                  <AccountPanelWithSearch pathname={pathname || ""} session={session} />
                </Suspense>
              )}

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

              <SidebarPanel title="Запчасти" href="/parts-finder" icon={<IconTools size={15} />}>
                {PARTS.map((item) => (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    color="indigo"
                    className="market-side-nav market-side-nav--nested"
                  />
                ))}
              </SidebarPanel>

              <SidebarPanel title="Мировые аукционы" href="/auctions" icon={<IconGavel size={15} />}>
                {AUCTIONS.map((item) => (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    color="orange"
                    className="market-side-nav market-side-nav--nested"
                  />
                ))}
              </SidebarPanel>

              <SidebarPanel title="Сервисы" href="/services" icon={<IconShieldCheck size={15} />}>
                {SERVICES.map((item) => (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    leftSection={item.icon}
                    active={pathname === item.href}
                    color={item.color}
                    className="market-side-nav market-side-nav--service"
                  />
                ))}
              </SidebarPanel>

              <Group justify="space-between" px={4} pt={2}>
                <Button component={Link} href="/news" variant="subtle" color="gray" size="compact-xs" leftSection={<IconNews size={14} />}>Новости</Button>
                <Button component={Link} href="/help/safety" variant="subtle" color="gray" size="compact-xs">Помощь</Button>
              </Group>
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <Box maw={1192} mx="auto" w="100%" className="app-main-content" style={{ flex: 1 }}>{children}</Box>
        <AppFooter />
      </AppShell.Main>
      <SupportChat />

      <nav className="mobile-bottom-nav" aria-label="Основная навигация">
        {MOBILE_NAV.map(({ href, label, Icon, accent }) => {
          const active = isMobileNavActive(href)
          return (
            <Link
              key={href}
              href={href}
              aria-label={label === "Подать" ? "Подать объявление" : label}
              aria-current={active ? "page" : undefined}
              className={`${accent ? "mobile-bottom-nav__accent" : ""}${active ? " mobile-bottom-nav__item--active" : ""}`}
            >
              <Icon size={accent ? 20 : 18} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </AppShell>
  )
}

function NavigationQuerySync({ onRouteChange }: { onRouteChange: () => void }) {
  const searchParams = useSearchParams()

  useEffect(() => {
    onRouteChange()
  }, [searchParams, onRouteChange])

  return null
}

function AccountPanelWithSearch({ pathname, session }: { pathname: string; session: ReturnType<typeof useSession>["data"] }) {
  const searchParams = useSearchParams()
  const dashboardTab = pathname === "/dashboard" ? searchParams.get("tab") || "listings" : null

  return <AccountPanel pathname={pathname} dashboardTab={dashboardTab} session={session} />
}

function AccountPanel({ pathname, dashboardTab, session }: { pathname: string; dashboardTab: string | null; session: ReturnType<typeof useSession>["data"] }) {
  if (session?.user) {
    const isAdmin = session.user.role === "ADMIN"
    const isModerator = session.user.role === "MODERATOR"
    const roleLabel = isAdmin ? "Администратор" : isModerator ? "Модератор" : "Личный кабинет"
    const roleColor = isAdmin ? "grape" : isModerator ? "orange" : "indigo"
    return <AuthenticatedAccountPanel pathname={pathname} dashboardTab={dashboardTab} session={session} roleLabel={roleLabel} roleColor={roleColor} isAdmin={isAdmin} isModerator={isModerator} />
  }

  return null
}

function AccountCounter({ value, color = "gray" }: { value: number; color?: string }) {
  if (value <= 0) return null
  return <Badge size="xs" radius="xl" variant="filled" color={color}>{value > 99 ? "99+" : value}</Badge>
}

function AuthenticatedAccountPanel({ pathname, dashboardTab, session, roleLabel, roleColor, isAdmin, isModerator }: {
  pathname: string
  dashboardTab: string | null
  session: NonNullable<ReturnType<typeof useSession>["data"]>
  roleLabel: string
  roleColor: "grape" | "orange" | "indigo"
  isAdmin: boolean
  isModerator: boolean
}) {
  const { data } = useSWR<AccountSummary>("/api/dashboard/stats", fetchJson, { revalidateOnFocus: false, dedupingInterval: 20_000 })
  const summary = data?.stats
  const workflow = data?.workflow
  const hasAttention = Boolean((workflow?.needsAttention || 0) + (workflow?.pendingModeration || 0) + (summary?.activeDeliveries || 0))

  return (
    <Paper className="market-side-account market-side-account--user" radius="lg" p="sm" withBorder shadow="xs" aria-label="Личный кабинет">
      <Group wrap="nowrap" gap="sm" align="center">
        <Avatar src={session.user.image} color={roleColor} radius="xl" size={44}>{session.user.name?.[0]?.toUpperCase()}</Avatar>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Group gap={5} wrap="nowrap" justify="space-between">
            <Badge variant="light" color={roleColor} size="xs">{roleLabel}</Badge>
            {hasAttention && <Badge variant="dot" color="orange" size="xs">Есть действия</Badge>}
          </Group>
          <Text size="sm" fw={800} lineClamp={1} mt={3}>{session.user.name || session.user.email}</Text>
        </Box>
      </Group>

      <Paper className="market-side-account__summary" radius="md" p="xs" mt="sm" withBorder>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Stack gap={0}><Text size="xs" c="dimmed" fw={650}>Ваш кабинет</Text><Text size="xs" fw={700}>{hasAttention ? "Проверьте новые события" : "Всё под контролем"}</Text></Stack>
          <ThemeIcon variant="light" color={hasAttention ? "orange" : "teal"} size={30} radius="md"><IconLayoutDashboard size={16} /></ThemeIcon>
        </Group>
      </Paper>

      <Stack gap={1} mt="xs">
        <NavLink component={Link} href="/dashboard" label="Мои объявления" leftSection={<IconLayoutDashboard size={16} />} rightSection={<AccountCounter value={summary?.totalListings || 0} color="indigo" />} active={pathname === "/dashboard" && dashboardTab === "listings"} color="indigo" variant="light" className="market-side-account__link" />
        <NavLink component={Link} href="/dashboard?tab=favorites" label="Избранное" leftSection={<IconHeart size={16} />} rightSection={<AccountCounter value={summary?.favoritesCount || 0} color="pink" />} active={pathname === "/dashboard" && dashboardTab === "favorites"} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href="/dashboard?tab=garage" label="Личный гараж" leftSection={<IconCar size={16} />} rightSection={<AccountCounter value={summary?.garageCount || 0} color="teal" />} active={pathname === "/dashboard" && dashboardTab === "garage"} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href="/dashboard/deliveries" label="Мои доставки" leftSection={<IconTruckDelivery size={16} />} rightSection={<AccountCounter value={summary?.activeDeliveries || 0} color="orange" />} active={pathname.startsWith("/dashboard/deliveries")} color="indigo" variant="subtle" className="market-side-account__link" />
        <Divider my={2} />
        <NavLink component={Link} href="/messages" label="Сообщения" leftSection={<IconMessageCircle2 size={16} />} rightSection={<AccountCounter value={summary?.unreadMessages || 0} color="red" />} active={pathname.startsWith("/messages")} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href="/notifications" label="Уведомления" leftSection={<IconBell size={16} />} rightSection={<AccountCounter value={summary?.unreadNotifications || 0} color="red" />} active={pathname.startsWith("/notifications")} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href="/dashboard?tab=profile" label="Профиль и настройки" leftSection={<IconSettings size={16} />} active={pathname === "/dashboard" && dashboardTab === "profile"} color="indigo" variant="subtle" className="market-side-account__link" />
        {isAdmin && <NavLink component={Link} href="/admin" label="Админ-панель" leftSection={<IconSettings size={16} />} active={pathname.startsWith("/admin")} color="grape" variant="light" className="market-side-account__link" />}
        {isModerator && <NavLink component={Link} href="/moderation" label="Модерация" leftSection={<IconGavel size={16} />} active={pathname.startsWith("/moderation")} color="orange" variant="light" className="market-side-account__link" />}
      </Stack>
      <Button component={Link} href="/listings/create/vehicle" variant="filled" color="indigo" size="xs" fullWidth mt="sm" leftSection={<IconPlus size={14} />}>Подать объявление</Button>
    </Paper>
  )
}

function SidebarPanel({ title, href, icon, children }: { title: string; href?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Paper className="market-side-panel" radius="lg" p={6} withBorder>
      {href ? (
        <Link href={href} className="market-side-panel__title-link">
          <Group gap={6} px={6} py={4}><ThemeIcon variant="light" color="indigo" size={22} radius="md">{icon}</ThemeIcon><Text size="10px" fw={800} tt="uppercase" c="dimmed">{title}</Text></Group>
        </Link>
      ) : (
        <Group gap={6} px={6} py={4}><ThemeIcon variant="light" color="indigo" size={22} radius="md">{icon}</ThemeIcon><Text size="10px" fw={800} tt="uppercase" c="dimmed">{title}</Text></Group>
      )}
      <Stack gap={1} mt={2}>{children}</Stack>
    </Paper>
  )
}
