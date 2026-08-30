"use client"

import dynamic from "next/dynamic"

import { AppShell, Avatar, Badge, Box, Button, Divider, Group, NavLink, Paper, ScrollArea, Stack, Text, ThemeIcon } from "@mantine/core"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import {
  IconBell, IconBrain, IconCar, IconChartBar, IconCreditCard, IconFileDescription, IconFileSearch, IconGasStation,
  IconGavel, IconHeart, IconHeartHandshake, IconHome2, IconLayoutDashboard, IconMessageCircle2, IconMessages, IconMotorbike,
  IconPlane, IconPlus, IconSettings, IconShieldCheck, IconSpeedboat, IconTools,
  IconBuildingStore, IconClipboardList, IconGift, IconTractor, IconTruck, IconTruckDelivery,
} from "@tabler/icons-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { useDisclosure } from "@mantine/hooks"
import AppAnalytics from "@/components/analytics/AppAnalytics"
import ReferralClaim from "@/components/referral/ReferralClaim"
import TelegramReturnBar from "@/components/telegram/TelegramReturnBar"
import { useTelegramSession } from "@/lib/use-telegram-session"
/* Чат поддержки грузится по требованию: он висит кнопкой в углу на
   каждой странице, но открывают его единицы. Прямой импорт тянул в общий
   бандл два десятка компонентов Mantine ради этой кнопки.

   ssr: false — чат целиком клиентский, на сервере отрисовывать нечего. */
const SupportChat = dynamic(() => import("@/components/support/SupportChat"), { ssr: false })
import { fetchJson } from "@/lib/api-client"
import {
  AUCTION_COUNTRY_NAVIGATION,
  getDashboardNavigationItem,
  PART_NAVIGATION,
  SERVICE_NAVIGATION,
  SITE_MOBILE_NAVIGATION,
  TRANSPORT_NAVIGATION,
} from "@/lib/navigation-registry"
import { navbarScrollTop } from "@/lib/navbar-scroll-sync"
import AppFooter from "./AppFooter"
import AppHeader from "./AppHeader"

const TRANSPORT_ICONS = {
  cars: <IconCar size={16} stroke={1.8} />,
  moto: <IconMotorbike size={16} stroke={1.8} />,
  trucks: <IconTruck size={16} stroke={1.8} />,
  special: <IconTractor size={16} stroke={1.8} />,
  water: <IconSpeedboat size={16} stroke={1.8} />,
  air: <IconPlane size={16} stroke={1.8} />,
} satisfies Record<(typeof TRANSPORT_NAVIGATION)[number]["id"], React.ReactNode>

const SERVICE_ICONS = {
  "fuel-map": <IconGasStation size={16} stroke={1.8} />,
  "history-check": <IconFileSearch size={16} stroke={1.8} />,
  valuation: <IconChartBar size={16} stroke={1.8} />,
  "smart-matching": <IconBrain size={16} stroke={1.8} />,
  "safe-deal": <IconShieldCheck size={16} stroke={1.8} />,
  "legal-documents": <IconFileDescription size={16} stroke={1.8} />,
} satisfies Record<(typeof SERVICE_NAVIGATION)[number]["id"], React.ReactNode>

const SERVICE_COLORS = {
  "fuel-map": "orange",
  "history-check": "cyan",
  valuation: "indigo",
  "smart-matching": "violet",
  "safe-deal": "teal",
  "legal-documents": "grape",
} satisfies Record<(typeof SERVICE_NAVIGATION)[number]["id"], string>

const MOBILE_ICONS = {
  home: IconHome2,
  "fuel-map": IconGasStation,
  create: IconPlus,
  forum: IconMessages,
  messages: IconMessageCircle2,
} satisfies Record<(typeof SITE_MOBILE_NAVIGATION)[number]["id"], typeof IconHome2>

const TRANSPORT = TRANSPORT_NAVIGATION.map((item) => ({ ...item, slug: item.id, icon: TRANSPORT_ICONS[item.id] }))
const PARTS = PART_NAVIGATION
const AUCTIONS = AUCTION_COUNTRY_NAVIGATION
const SERVICES = SERVICE_NAVIGATION.map((item) => ({ ...item, icon: SERVICE_ICONS[item.id], color: SERVICE_COLORS[item.id] }))
const MOBILE_NAV = SITE_MOBILE_NAVIGATION.map((item) => ({ ...item, Icon: MOBILE_ICONS[item.id], accent: item.id === "create" }))
const ACCOUNT_NAVIGATION = {
  listings: getDashboardNavigationItem("listings"),
  favorites: getDashboardNavigationItem("favorites"),
  garage: getDashboardNavigationItem("garage"),
  deliveries: getDashboardNavigationItem("deliveries"),
  documents: getDashboardNavigationItem("documents"),
  messages: getDashboardNavigationItem("messages"),
  payments: getDashboardNavigationItem("payments"),
  profile: getDashboardNavigationItem("profile"),
}

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
  partnerAccess?: {
    allowed: boolean
    applicationStatus: "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED"
  }
}

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpened, { close: closeMobile, toggle: toggleMobile }] = useDisclosure(false)
  const isAuthRoute = pathname?.startsWith("/auth/")
  // Telegram Web Apps should open as a focused, full-screen experience. Rendering
  // the desktop shell around it wastes the mobile viewport and duplicates navigation.
  /* Страница, открытая из мини-приложения, тоже идёт без обвязки сайта.

     Ссылки из мини-приложения помечены `from=telegram` и ведут на
     обычные страницы: форум, запчасти, избранное, карточку машины.
     Раньше признак читали три компонента, и только чтобы дописать его к
     ссылке входа, — а сама страница приезжала с десктопной шапкой,
     подвалом и боковым каталогом во вьюпорте телефона. Вернуться в
     ленту было нечем: панели вкладок там нет.

     Признак запоминается на время сеанса: переходя дальше по сайту,
     человек теряет параметр из адреса, но остаётся внутри Telegram, и
     обвязка не должна возвращаться посреди пути. */
  const fromTelegram = useTelegramSession()
  const isStandaloneRoute = isAuthRoute || pathname?.startsWith("/telegram") || fromTelegram
  /* Страница объявления идёт во всю ширину.
     Каталог разделов слева занимал 236px там, где человек уже выбрал машину:
     предложение уйти в «Мото» или «Запчасти» здесь работает против сделки, а
     фотографии и характеристикам ширины не хватало. Шапка и подвал остаются —
     уходит только боковое меню, как на auto.ru и Carvana. */
  const isDetailRoute = Boolean(
    pathname?.startsWith("/listings/vehicle/") ||
    pathname?.startsWith("/listings/part/") ||
    pathname?.startsWith("/auctions/"),
  )
  const activeCategory = pathname?.startsWith("/category/") ? pathname.split("/")[2] : null
  const isMobileNavActive = (href: string) => href === "/" ? pathname === "/" : pathname?.startsWith(href)

  useEffect(() => {
    closeMobile()
  }, [pathname, closeMobile])

  /**
   * Меню укорачивается, когда в кадр входит подвал.
   *
   * Меню закреплено на всю высоту экрана, а подвал занимает всю ширину окна и
   * проходит поверх него. Из-за этого нижние пункты списка оказывались под
   * подвалом: прокручивать было нечего — список помещался целиком, — но
   * увидеть его конец было нельзя.
   *
   * Здесь мы измеряем, сколько экрана отъел подвал, и на столько же
   * подрезаем меню снизу. Как только внутри становится тесно, ScrollArea
   * получает настоящую прокрутку, и до последнего пункта можно долистать.
   */
  useEffect(() => {
    if (typeof window === "undefined") return

    const updateInset = () => {
      const footer = document.querySelector(".market-app-footer")
      const overlap = footer
        ? Math.max(0, window.innerHeight - footer.getBoundingClientRect().top)
        : 0
      document.documentElement.style.setProperty("--app-navbar-bottom-inset", `${Math.round(overlap)}px`)

      // Меню закреплено (fixed) и потому само по себе не двигается: человек
      // прокручивал страницу вниз, а список стоял, будто завис. Здесь мы
      // доматываем его внутреннюю прокрутку вместе со страницей — ровно до
      // конца списка, дальше он просто остаётся на месте.
      const viewport = document.querySelector<HTMLElement>(
        ".market-app-navbar .mantine-ScrollArea-viewport",
      )
      if (!viewport) return
      const next = navbarScrollTop({
        contentHeight: viewport.scrollHeight,
        viewportHeight: viewport.clientHeight,
        pageHeight: document.documentElement.scrollHeight,
        windowHeight: window.innerHeight,
        scrollY: window.scrollY,
      })
      if (next !== null) viewport.scrollTop = next
    }

    /* Пересчёт идёт раз на кадр, а не на каждое событие.

       Браузер шлёт до сотни событий прокрутки в секунду, и на каждом
       здесь читались getBoundingClientRect, scrollHeight и clientHeight
       — то есть браузер был вынужден пересчитывать раскладку страницы
       заново. Хуже: следом шла запись scrollTop, и пересчёт случался
       второй раз. На длинных страницах каталога это и было заметным
       подтормаживанием прокрутки на слабых телефонах.

       Кадр отменяется при следующем событии: считаем последнее
       положение, а не очередь устаревших. */
    let frame: number | null = null
    const scheduleUpdate = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        updateInset()
      })
    }

    updateInset()
    window.addEventListener("scroll", scheduleUpdate, { passive: true })
    window.addEventListener("resize", scheduleUpdate)
    // Высота подвала меняется при подгрузке контента, а не только при скролле.
    const observer = new ResizeObserver(scheduleUpdate)
    observer.observe(document.body)

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("resize", scheduleUpdate)
      observer.disconnect()
    }
  }, [])

  if (isStandaloneRoute) {
    return (
      <Box component="main" style={{ minHeight: "100vh", background: "var(--market-background)" }}>
        {/* Счётчик читает строку запроса, а useSearchParams требует границы
            Suspense: без неё страница целиком ушла бы в клиентский рендер. */}
        <Suspense fallback={null}><AppAnalytics /><ReferralClaim /></Suspense>
        {/* Полоса возврата — только на страницах сайта: внутри самого
            приложения внизу есть панель вкладок. */}
        {fromTelegram && !pathname?.startsWith("/telegram") && <TelegramReturnBar />}
        {children}
        {isAuthRoute && <SupportChat />}
      </Box>
    )
  }

  return (
    <AppShell
      // Значение совпадает с --app-header-height: боковое меню и подвал
      // считают от него свои отступы.
      header={{ height: 68 }}
      navbar={{ width: 236, breakpoint: "md", collapsed: { mobile: !mobileOpened, desktop: isDetailRoute } }}
      padding={0}
      style={{ minHeight: "100vh", background: "var(--market-background)" }}
    >
      <Suspense fallback={null}>
        {/* Счётчик посещений читает строку запроса: смена фильтров каталога —
            такой же переход, как открытие нового раздела. */}
        <AppAnalytics />
        {/* Приглашение закрепляется за человеком, пришедшим по
            партнёрской ссылке. Читает адресную строку, поэтому живёт
            под той же границей Suspense, что и счётчик посещений. */}
        <ReferralClaim />
        <NavigationQuerySync onRouteChange={closeMobile} />
      </Suspense>
      {/* Ссылка «к содержимому» — первая цель табуляции.

          Замер показал: с клавиатуры до основного контента 36 нажатий Tab —
          человек каждый раз проходит всю шапку и каталог разделов в боковом
          меню. Ссылка не видна мышью и появляется только при фокусе. */}
      <a href="#main-content" className="skip-to-content">
        Перейти к содержимому
      </a>

      <AppShell.Header>
        <AppHeader navigationOpened={mobileOpened} onNavigationToggle={toggleMobile} />
      </AppShell.Header>

      <AppShell.Navbar className="market-app-navbar" p={0} style={{ background: "var(--market-surface-subtle)", borderRight: "1px solid var(--market-line)" }}>
        <AppShell.Section grow component={ScrollArea} type="hover" scrollbarSize={5}>
          <Stack gap="xs" p="xs">
              {/* Для гостя вход уже доступен в хедере: не дублируем две одинаковые пары кнопок. */}
              {session?.user && (
                <Suspense fallback={<AccountPanel pathname={pathname || ""} dashboardTab="listings" session={session} />}>
                  <AccountPanelWithSearch pathname={pathname || ""} session={session} />
                </Suspense>
              )}

              <Button
                component={Link}
                href="/dashboard/deliveries?partner=apply"
                prefetch={false}
                hiddenFrom="md"
                variant="light"
                color="orange"
                size="md"
                leftSection={<IconHeartHandshake size={18} stroke={1.8} />}
                className="market-mobile-partner-cta"
              >
                Стать партнёром
              </Button>

              <SidebarPanel title="Транспорт" icon={<IconCar size={15} />}>
                {TRANSPORT.map((item) => (
                  <NavLink
                    key={item.slug}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    leftSection={item.icon}
                    active={activeCategory === item.slug}
                    color="indigo"
                    className="market-side-nav"
                  />
                ))}
              </SidebarPanel>

              <SidebarPanel title="Запчасти" href="/parts-finder" icon={<IconTools size={15} />}>
                <Suspense fallback={PARTS.map((item) => <NavLink key={item.href} component={Link} href={item.href} prefetch={false} label={item.label} color="indigo" className="market-side-nav market-side-nav--nested" />)}>
                  <PartCategoryLinks pathname={pathname || ""} />
                </Suspense>
              </SidebarPanel>

              <SidebarPanel title="Мировые аукционы" href="/auctions" icon={<IconGavel size={15} />}>
                <Suspense fallback={AUCTIONS.map((item) => <NavLink key={item.href} component={Link} href={item.href} prefetch={false} label={item.label} color="orange" className="market-side-nav market-side-nav--nested" />)}>
                  <AuctionCountryLinks pathname={pathname || ""} />
                </Suspense>
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

              {/* «Новости» и «Помощь» есть в шапке, а здесь они упирались в
                  нижний край прокручиваемой области и обрезались. Дубль убран,
                  вместо него — отступ, чтобы последний блок меню не липнул к
                  краю. */}
              <Box h={8} />
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      {/* Подвал вынесен из потока Main и растянут на всю ширину окна: Mantine
          сдвигает Main вправо на ширину сайдбара, и подвал обрывался, не
          доходя до левого края экрана. */}
      <AppShell.Main style={{ minHeight: "calc(100dvh - var(--app-header-height))", display: "flex", flexDirection: "column" }}>
        <Box id="main-content" maw={1280} mx="auto" w="100%" className="app-main-content" style={{ flex: 1 }}>{children}</Box>
        <div className="app-footer-bleed">
          <AppFooter />
        </div>
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

function AuctionCountryLinks({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams()
  const selectedCountry = pathname === "/auctions" ? searchParams.get("country") : null

  return AUCTIONS.map((item) => {
    const country = item.href.split("country=")[1]
    return <NavLink key={item.href} component={Link} href={item.href} prefetch={false} label={item.label} active={selectedCountry === country} color="orange" className="market-side-nav market-side-nav--nested" />
  })
}

/**
 * Подсвечивает выбранную группу запчастей так же, как страну у аукционов:
 * без этого пользователь, перешедший из меню, не видит, где находится.
 */
function PartCategoryLinks({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams()
  const selectedPartType = pathname === "/parts-finder" ? searchParams.get("partType") : null

  return PARTS.map((item) => {
    const partType = item.href.split("partType=")[1]
    return <NavLink key={item.href} component={Link} href={item.href} prefetch={false} label={item.label} active={selectedPartType === partType} color="indigo" className="market-side-nav market-side-nav--nested" />
  })
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

  return <GuestAccountPanel />
}

/**
 * Меню для того, кто ещё не вошёл.
 *
 * Раньше здесь было пусто: гость не видел ни кнопки подачи объявления,
 * ни приглашения войти. Продавец, открывший меню с телефона, не находил,
 * где разместить машину.
 *
 * Про бесплатность сказано сразу: на весь сайт это упоминалось лишь на
 * одной странице в подвале, до которой шесть экранов прокрутки.
 */
function GuestAccountPanel() {
  return (
    <Paper className="market-side-account" radius="md" p={10} withBorder>
      <Text size="xs" c="dimmed" fw={700} tt="uppercase">Продаёте машину?</Text>
      <Text size="xs" c="dimmed" mt={4} lh={1.45}>
        Размещение бесплатное. Аккаунт нужен, чтобы объявление было привязано к вам.
      </Text>
      <Button
        component={Link}
        href="/listings/create/vehicle"
        size="sm"
        fullWidth
        mt="sm"
        className="market-side-account__cta"
        leftSection={<IconPlus size={15} />}
      >
        Подать объявление
      </Button>
      <Button
        component={Link}
        href="/auth/signin"
        size="sm"
        fullWidth
        mt={6}
        variant="light"
        color="indigo"
      >
        Войти
      </Button>
    </Paper>
  )
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
  // Партнёрские разделы показываются только тем, кто прошёл проверку
  // компании. Раньше они висели в меню у всех, и обычный продавец открывал
  // магазин лишь затем, чтобы получить отказ доступа.
  const isPartner = Boolean(data?.partnerAccess?.allowed)

  return (
    <Paper className="market-side-account market-side-account--user" radius="md" p="sm" withBorder shadow="xs" aria-label="Личный кабинет">
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
          {/* Подпись и значение различаются цветом, а не весом: раньше 650
              против 700 на одном кегле читалось как неровность набора. */}
          <Stack gap={0}><Text size="xs" c="dimmed" fw={500}>Ваш кабинет</Text><Text size="xs" fw={700}>{hasAttention ? "Проверьте новые события" : "Всё под контролем"}</Text></Stack>
          <ThemeIcon variant="light" color={hasAttention ? "orange" : "teal"} size={30} radius="md"><IconLayoutDashboard size={16} /></ThemeIcon>
        </Group>
      </Paper>

      <Stack gap={1} mt="xs">
        <NavLink component={Link} href={ACCOUNT_NAVIGATION.listings.href} label={ACCOUNT_NAVIGATION.listings.label} leftSection={<IconLayoutDashboard size={16} />} rightSection={<AccountCounter value={summary?.totalListings || 0} color="indigo" />} active={pathname === "/dashboard" && dashboardTab === "listings"} color="indigo" variant="light" className="market-side-account__link" />
        <NavLink component={Link} href={ACCOUNT_NAVIGATION.favorites.href} label={ACCOUNT_NAVIGATION.favorites.label} leftSection={<IconHeart size={16} />} rightSection={<AccountCounter value={summary?.favoritesCount || 0} color="pink" />} active={pathname.startsWith("/favorites")} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href={ACCOUNT_NAVIGATION.garage.href} label={ACCOUNT_NAVIGATION.garage.label} leftSection={<IconCar size={16} />} rightSection={<AccountCounter value={summary?.garageCount || 0} color="teal" />} active={pathname === "/dashboard" && dashboardTab === "garage"} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href="/dashboard/orders" prefetch={false} label="Мои заказы" leftSection={<IconClipboardList size={16} />} active={pathname.startsWith("/dashboard/orders")} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href={ACCOUNT_NAVIGATION.deliveries.href} prefetch={false} label={ACCOUNT_NAVIGATION.deliveries.label} leftSection={<IconTruckDelivery size={16} />} rightSection={<AccountCounter value={summary?.activeDeliveries || 0} color="orange" />} active={pathname.startsWith("/dashboard/deliveries")} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href={ACCOUNT_NAVIGATION.documents.href} prefetch={false} label={ACCOUNT_NAVIGATION.documents.label} leftSection={<IconFileDescription size={16} />} active={pathname.startsWith("/dashboard/documents")} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href={ACCOUNT_NAVIGATION.payments.href} label={ACCOUNT_NAVIGATION.payments.label} leftSection={<IconCreditCard size={16} />} active={pathname === "/dashboard" && dashboardTab === "payments"} color="indigo" variant="subtle" className="market-side-account__link" />

        {/* Партнёрский блок отделён подписью: до проверки компании этих
            разделов в меню нет вовсе, поэтому список у обычного продавца
            короче на треть. */}
        {isPartner && (
          <>
            <Text className="market-side-account__group" component="p">Партнёрские разделы</Text>
            <NavLink component={Link} href="/dashboard/store" prefetch={false} label="Магазин запчастей" leftSection={<IconBuildingStore size={16} />} active={pathname.startsWith("/dashboard/store")} color="indigo" variant="subtle" className="market-side-account__link" />
          </>
        )}

        {/* Приглашать друзей может любой пользователь — это не партнёрский
            раздел для проверенных компаний, поэтому и название другое. */}
        <NavLink component={Link} href="/dashboard/referral" prefetch={false} label="Пригласить друзей" leftSection={<IconGift size={16} />} active={pathname.startsWith("/dashboard/referral")} color="indigo" variant="subtle" className="market-side-account__link" />
        <Divider my={2} />
        <NavLink component={Link} href={ACCOUNT_NAVIGATION.messages.href} label={ACCOUNT_NAVIGATION.messages.label} leftSection={<IconMessageCircle2 size={16} />} rightSection={<AccountCounter value={summary?.unreadMessages || 0} color="red" />} active={pathname.startsWith("/messages")} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href="/notifications" prefetch={false} label="Уведомления" leftSection={<IconBell size={16} />} rightSection={<AccountCounter value={summary?.unreadNotifications || 0} color="red" />} active={pathname.startsWith("/notifications")} color="indigo" variant="subtle" className="market-side-account__link" />
        <NavLink component={Link} href={ACCOUNT_NAVIGATION.profile.href} label={ACCOUNT_NAVIGATION.profile.label} leftSection={<IconSettings size={16} />} active={pathname === "/dashboard" && dashboardTab === "profile"} color="indigo" variant="subtle" className="market-side-account__link market-side-account__link--profile" />
        {isAdmin && <NavLink component={Link} href="/admin" prefetch={false} label="Админ-панель" leftSection={<IconSettings size={16} />} active={pathname.startsWith("/admin")} color="grape" variant="light" className="market-side-account__link" />}
        {isModerator && <NavLink component={Link} href="/moderation" prefetch={false} label="Модерация" leftSection={<IconGavel size={16} />} active={pathname.startsWith("/moderation")} color="orange" variant="light" className="market-side-account__link" />}
      </Stack>
      {/* Главное действие продавца выделено акцентом: среди индиговых пунктов
          меню одноцветная кнопка терялась. */}
      <Button component={Link} href="/listings/create/vehicle" size="sm" fullWidth mt="sm" className="market-side-account__cta" leftSection={<IconPlus size={15} />}>Подать объявление</Button>
    </Paper>
  )
}

function SidebarPanel({ title, href, icon, children }: { title: string; href?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Paper className="market-side-panel" radius="md" p={6} withBorder>
      {href ? (
        <Link href={href} className="market-side-panel__title-link">
          <Group gap={6} px={6} py={4}><ThemeIcon variant="light" color="indigo" size={22} radius="md">{icon}</ThemeIcon><Text size="10px" fw={700} tt="uppercase" c="dimmed">{title}</Text></Group>
        </Link>
      ) : (
        <Group gap={6} px={6} py={4}><ThemeIcon variant="light" color="indigo" size={22} radius="md">{icon}</ThemeIcon><Text size="10px" fw={700} tt="uppercase" c="dimmed">{title}</Text></Group>
      )}
      <Stack gap={1} mt={2}>{children}</Stack>
    </Paper>
  )
}
