"use client"

import { Box, Burger, Group, Text, TextInput, ActionIcon, Indicator, Menu, Avatar, Button, Divider, Container, Loader, Popover, Stack } from "@mantine/core"
import { IconSearch, IconBell, IconMessageCircle2, IconHeart, IconPlus, IconLogout, IconSettings, IconLayoutDashboard, IconCar, IconUserPlus, IconGavel, IconTools, IconShieldCheck, IconHelpCircle, IconNews, IconBrain, IconChartBar, IconFileDescription, IconFileSearch, IconGasStation, IconHeartHandshake } from "@tabler/icons-react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useColorScheme } from "@/components/providers/AppProviders"
import { IconSun, IconMoon } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import LeWheelBrand from "@/components/brand/LeWheelBrand"

type SearchSuggestion = {
  id: string
  title: string
  price: number | null
  vehicle?: { id: string; make: string; model: string; vehicleType?: string | null } | null
  part?: { id: string; name: string } | null
}

type SearchSuggestionResponse = { listings?: SearchSuggestion[] }
type FavoriteCountResponse = { count?: number }

type NavigationItem = {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
}

export default function AppHeader({ navigationOpened = false, onNavigationToggle }: { navigationOpened?: boolean; onNavigationToggle?: () => void }) {
  const { data: session } = useSession()
  const [favCount, setFavCount] = useState(0)
  useEffect(() => {
    if (!session) {
      setFavCount(0)
      return
    }

    let isCurrent = true
    void fetchJson<FavoriteCountResponse>("/api/favorites?countOnly=true")
      .then((payload) => { if (isCurrent) setFavCount(payload.count || 0) })
      .catch(() => { if (isCurrent) setFavCount(0) })

    return () => { isCurrent = false }
  }, [session])
  const { colorScheme, toggleScheme } = useColorScheme()
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [searchRequestVersion, setSearchRequestVersion] = useState(0)

  const catalogueNavigation: NavigationItem[] = [
    { href: "/", label: "Объявления", icon: null, active: pathname === "/" || pathname.startsWith("/category") || pathname.startsWith("/search") },
    { href: "/parts-finder", label: "Запчасти", icon: <IconTools size={14} />, active: pathname.startsWith("/parts") },
    { href: "/auctions", label: "Аукционы", icon: <IconGavel size={14} />, active: pathname.startsWith("/auctions") },
  ]
  const serviceNavigation: NavigationItem[] = [
    { href: "/news", label: "Новости", icon: <IconNews size={14} />, active: pathname.startsWith("/news") },
    { href: "/help", label: "Помощь", icon: <IconHelpCircle size={14} />, active: pathname.startsWith("/help") },
    // «Сервисы» последним: это набор инструментов, а не раздел каталога,
    // и человек идёт туда после того, как разобрался с основным.
    { href: "/services", label: "Сервисы", icon: <IconShieldCheck size={14} />, active: pathname.startsWith("/services") },
  ]
  const serviceShortcuts: NavigationItem[] = [
    { href: "/services/fuel-map", label: "Карта АЗС", icon: <IconGasStation size={15} />, active: pathname.startsWith("/services/fuel-map") },
    { href: "/services/history-check", label: "Проверка истории", icon: <IconFileSearch size={15} />, active: pathname.startsWith("/services/history-check") },
    { href: "/services/valuation", label: "Оценка стоимости", icon: <IconChartBar size={15} />, active: pathname.startsWith("/services/valuation") },
    { href: "/services/smart-matching", label: "Умный подбор", icon: <IconBrain size={15} />, active: pathname.startsWith("/services/smart-matching") },
    { href: "/services/legal-documents", label: "Документы сделки", icon: <IconFileDescription size={15} />, active: pathname.startsWith("/services/legal-documents") },
  ]
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  const searchValue = query.trim()
  const shouldShowSuggestions = isSearchFocused && searchValue.length >= 2

  useEffect(() => {
    if (searchValue.length < 2) {
      setSuggestions([])
      setIsSuggestionsLoading(false)
      setSearchError(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsSuggestionsLoading(true)
      setSearchError(false)
      try {
        const data = await fetchJson<SearchSuggestionResponse>(`/api/listings?q=${encodeURIComponent(searchValue)}&limit=5`, {
          signal: controller.signal,
          cache: "no-store",
        })
        setSuggestions(Array.isArray(data.listings) ? data.listings : [])
      } catch (error) {
        const requestWasAborted = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")
        if (!requestWasAborted) {
          setSuggestions([])
          setSearchError(true)
        }
      } finally {
        if (!controller.signal.aborted) setIsSuggestionsLoading(false)
      }
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [searchRequestVersion, searchValue])

  const suggestionHref = (suggestion: SearchSuggestion) => suggestion.vehicle
    ? `/listings/vehicle/${suggestion.vehicle.id}`
    : `/listings/part/${suggestion.part?.id || suggestion.id}`

  return (
    <Box
      className="market-app-header"
      h="100%"
      style={{
        background: "var(--mantine-color-body)",
        borderBottom: "1px solid var(--mantine-color-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <Container size="xl" px={{ base: "sm", md: "md" }} style={{ height: "var(--app-header-height)" }}>
        <Group h="100%" gap="sm" wrap="nowrap" align="center" justify="space-between">
          {/* ЛЕВО: Лого */}
          {onNavigationToggle && <Burger hiddenFrom="md" opened={navigationOpened} onClick={onNavigationToggle} size="sm" aria-label={navigationOpened ? "Закрыть навигацию" : "Открыть навигацию"} />}
          <Link href="/" style={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}>
            <LeWheelBrand size={38} priority />
          </Link>

          {/* Разделы каталога — плоские вкладки, а не выпадающая плашка.
              Три пункта прятать под кнопку незачем: человек и так видит,
              куда идти, а лишний клик только удлинял путь. */}
          <Group gap={2} visibleFrom="md" wrap="nowrap" className="market-app-header__tabs">
            {catalogueNavigation.map((item) => (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                variant="subtle"
                color="indigo"
                size="compact-sm"
                leftSection={item.icon || <IconCar size={14} />}
                aria-current={item.active ? "page" : undefined}
                className={`market-header-tab${item.active ? " market-header-tab--active" : ""}`}
              >
                {item.label}
              </Button>
            ))}
          </Group>

          <ServiceNavigationMenu serviceNavigation={serviceNavigation} serviceShortcuts={serviceShortcuts} />

          <Group gap={2} visibleFrom="xl" wrap="nowrap" className="market-app-header__links">
            {serviceNavigation.filter((item) => item.href !== "/services").map((item) => (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                variant={item.active ? "light" : "subtle"}
                color="indigo"
                size="compact-sm"
                leftSection={item.icon}
                aria-current={item.active ? "page" : undefined}
                className={`market-app-header__link${item.active ? " market-app-header__link--active" : ""}`}
                styles={{ root: { fontWeight: item.active ? 700 : 600 } }}
              >
                {item.label}
              </Button>
            ))}
          </Group>

          <Button
            component={Link}
            href="/dashboard/deliveries?partner=apply"
            visibleFrom="xl"
            size="compact-sm"
            radius="md"
            leftSection={<IconHeartHandshake size={15} stroke={1.9} />}
            className="partner-header-cta"
          >
            Стать партнёром
          </Button>

          {/* ЦЕНТР: Поиск — максимальная ширина */}
          <Popover opened={shouldShowSuggestions} position="bottom-start" width="target" offset={8} shadow="lg" radius="lg" withinPortal>
            <Popover.Target>
              <Box component="form" onSubmit={handleSearch} className="market-header-search" style={{ flex: "1 1 180px", maxWidth: 380, minWidth: 0 }} visibleFrom="sm">
                <TextInput
                  placeholder="Марка, модель или город"
                  leftSection={<IconSearch size={16} color="gray.4" />}
                  rightSection={isSuggestionsLoading ? <Loader size={14} color="indigo" /> : undefined}
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 120)}
                  radius="md"
                  size="sm"
                  variant="filled"
                  styles={{
                    input: {
                      background: "var(--market-surface-subtle)",
                      border: "1px solid var(--market-field-line)",
                      height: 38,
                      transition: "border-color 200ms ease, box-shadow 200ms ease, background 200ms ease",
                    },
                  }}
                />
              </Box>
            </Popover.Target>
            <Popover.Dropdown className="market-header-search__suggestions" p={6}>
              {isSuggestionsLoading && suggestions.length === 0 ? (
                <Group gap="xs" px="sm" py={8}><Loader size="xs" color="indigo" /><Text size="xs" c="dimmed">Ищем объявления…</Text></Group>
              ) : searchError ? (
                <Stack gap={6} px="sm" py={8}>
                  <Text size="xs" c="dimmed">Не удалось обновить подсказки. Полный поиск всё ещё доступен.</Text>
                  <Button variant="subtle" color="indigo" size="compact-xs" onClick={() => setSearchRequestVersion((current) => current + 1)}>Повторить</Button>
                </Stack>
              ) : suggestions.length > 0 ? (
                <Stack gap={2}>
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.id}
                      component={Link}
                      href={suggestionHref(suggestion)}
                      onClick={() => setIsSearchFocused(false)}
                      variant="subtle"
                      color="dark"
                      justify="space-between"
                      className="market-header-search__suggestion"
                      leftSection={<IconSearch size={14} stroke={1.8} />}
                      rightSection={suggestion.price !== null ? <Text size="xs" fw={750} c="indigo.7">{new Intl.NumberFormat("ru-RU").format(suggestion.price)} ₽</Text> : undefined}
                    >
                      <Text component="span" size="sm" fw={650} truncate>{suggestion.title}</Text>
                    </Button>
                  ))}
                </Stack>
              ) : (
                <Box px="sm" py={8}><Text size="xs" c="dimmed">По запросу «{searchValue}» пока ничего нет.</Text></Box>
              )}
              <Button component={Link} href={`/search?q=${encodeURIComponent(searchValue)}`} onClick={() => setIsSearchFocused(false)} variant="light" color="indigo" fullWidth size="xs" mt={5}>
                Смотреть все результаты
              </Button>
            </Popover.Dropdown>
          </Popover>

          <ActionIcon
            component={Link}
            href="/search"
            className="market-header-search-trigger"
            variant="light"
            color="indigo"
            size="md"
            radius="md"
            visibleFrom="sm"
            aria-label="Открыть поиск"
          >
            <IconSearch size={18} stroke={1.8} />
          </ActionIcon>

          {/* ПРАВО: Кнопки — разделены визуально */}
          <Group gap={6} wrap="nowrap" align="center" className="market-app-header__utility">
            {/* Продать — яркая индиго */}
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              radius="md"
              className="market-app-header__utility-action"
              onClick={toggleScheme}
              aria-label="Сменить тему"
              visibleFrom="sm"
            >
              {colorScheme === "dark" ? <IconSun size={18} stroke={1.8} /> : <IconMoon size={18} stroke={1.8} />}
            </ActionIcon>

            <ActionIcon component={Link} href="/listings/create/quick" variant="light" color="indigo" size="md" radius="md" visibleFrom="sm" hiddenFrom="md" aria-label="Разместить объявление">
              <IconPlus size={18} stroke={1.8} />
            </ActionIcon>

            <Button
              component={Link}
              href="/listings/create/quick"
              leftSection={<IconPlus size={15} />}
              size="sm"
              radius="md"
              color="indigo"
              variant="filled"
              visibleFrom="md"
              className="header-create-cta"
              styles={{ root: { height: 38, fontWeight: 700 } }}
            >
              Подать объявление
            </Button>

            {session ? (
              <>
                <Box visibleFrom="sm"><Indicator size={7} color="red" offset={4} disabled={favCount === 0}>
                  <ActionIcon component={Link} href="/favorites" variant="subtle" color="gray" size="lg" radius="md" className="market-app-header__utility-action" aria-label="Избранное">
                    <IconHeart size={18} stroke={1.8} />
                  </ActionIcon>
                </Indicator></Box>
                <Box visibleFrom="sm"><Indicator size={7} color="violet" offset={4}>
                  <ActionIcon component={Link} href="/messages" variant="subtle" color="gray" size="lg" radius="md" className="market-app-header__utility-action" aria-label="Сообщения">
                    <IconMessageCircle2 size={18} stroke={1.8} />
                  </ActionIcon>
                </Indicator></Box>
                <Box visibleFrom="sm"><Indicator size={7} color="red" offset={4}>
                  <ActionIcon component={Link} href="/notifications" variant="subtle" color="gray" size="lg" radius="md" className="market-app-header__utility-action" aria-label="Уведомления">
                    <IconBell size={18} stroke={1.8} />
                  </ActionIcon>
                </Indicator></Box>
                <Box visibleFrom="sm"><Divider orientation="vertical" mx={2} h={26} /></Box>
                <Menu shadow="md" width={220} position="bottom-end" radius="md" offset={4}>
                  <Menu.Target>
                    <ActionIcon variant="subtle" radius="xl" size={32} aria-label="Открыть меню профиля" className="market-app-header__utility-action market-app-header__utility-action--avatar">
                      <Avatar src={session.user?.image} size={28} radius="xl" color="indigo">
                        {session.user?.name?.[0]?.toUpperCase()}
                      </Avatar>
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Профиль</Menu.Label>
                    <Box px="sm" py={6}>
                      <Text size="sm" fw={600} c="dark.9" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {session.user?.name || session.user?.email}
                      </Text>
                    </Box>
                    <Menu.Divider />
                    <Menu.Label>Кабинет</Menu.Label>
                    <Menu.Item component={Link} href="/dashboard" leftSection={<IconLayoutDashboard size={15} />}>Личный кабинет</Menu.Item>
                    <Menu.Item component={Link} href="/dashboard?tab=listings" leftSection={<IconCar size={15} />}>Мои объявления</Menu.Item>
                    <Menu.Item component={Link} href="/messages" leftSection={<IconMessageCircle2 size={15} />}>Сообщения</Menu.Item>
                    <Menu.Item component={Link} href="/notifications" leftSection={<IconBell size={15} />}>Уведомления</Menu.Item>
                    <Menu.Item component={Link} href="/favorites" leftSection={<IconHeart size={15} />}>Избранное</Menu.Item>
                    <Menu.Item component={Link} href="/dashboard?tab=profile" leftSection={<IconSettings size={15} />}>Настройки профиля</Menu.Item>
                    {session.user?.role === "ADMIN" && (
                      <>
                        <Menu.Divider />
                        <Menu.Item component={Link} href="/admin" leftSection={<IconSettings size={15} />} color="red">Админ-панель</Menu.Item>
                      </>
                    )}
                    {session.user?.role === "MODERATOR" && (
                      <>
                        <Menu.Divider />
                        <Menu.Item component={Link} href="/moderation" leftSection={<IconGavel size={15} />} color="orange">Модерация объявлений</Menu.Item>
                      </>
                    )}
                    <Menu.Divider />
                    <Menu.Item leftSection={<IconLogout size={15} />} onClick={() => signOut({ callbackUrl: "/" })} color="red">Выйти</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </>
            ) : (
              <>
                <Box visibleFrom="sm"><Divider orientation="vertical" mx={2} h={26} /></Box>
                <Button component={Link} href="/auth/signin" variant="default" color="gray" size="sm" radius="md" styles={{ root: { height: 38, fontWeight: 700 } }}>
                  Войти
                </Button>
                <Button component={Link} href="/auth/signup" variant="light" color="indigo" size="sm" radius="md" visibleFrom="xs" styles={{ root: { height: 38, fontWeight: 700 } }}>
                  Регистрация
                </Button>
                <ActionIcon component={Link} href="/auth/signup" variant="light" color="indigo" size="md" radius="md" hiddenFrom="xs" aria-label="Регистрация">
                  <IconUserPlus size={18} stroke={1.8} />
                </ActionIcon>
              </>
            )}
          </Group>
        </Group>
      </Container>
    </Box>
  )
}

function ServiceNavigationMenu({ serviceNavigation, serviceShortcuts }: { serviceNavigation: NavigationItem[]; serviceShortcuts: NavigationItem[] }) {
  const serviceIsActive = serviceNavigation[0]?.active || serviceShortcuts.some((item) => item.active)

  return (
    <Box visibleFrom="md">
      <Menu shadow="md" width={244} position="bottom-start" radius="md" offset={6} withinPortal>
        <Menu.Target>
          <Button
            variant={serviceIsActive ? "light" : "subtle"}
            color="indigo"
            size="compact-sm"
            leftSection={<IconShieldCheck size={15} />}
            aria-label="Открыть сервисы площадки"
          >
            Сервисы
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Инструменты водителя</Menu.Label>
          {serviceShortcuts.map((item) => (
            <Menu.Item key={item.href} component={Link} href={item.href} leftSection={item.icon} color={item.active ? "indigo" : undefined}>
              {item.label}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Label>Партнёрская сеть</Menu.Label>
          <Menu.Item component={Link} href="/dashboard/deliveries?partner=apply" leftSection={<IconHeartHandshake size={15} />} color="orange">
            Стать партнёром
          </Menu.Item>
          <Menu.Divider />
          <Menu.Label>Площадка и поддержка</Menu.Label>
          {serviceNavigation.map((item) => (
            <Menu.Item key={item.href} component={Link} href={item.href} leftSection={item.icon} color={item.active ? "indigo" : undefined}>
              {item.href === "/services" ? "Все сервисы" : item.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Box>
  )
}
