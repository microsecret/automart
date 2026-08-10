"use client"

import { Box, Group, Text, TextInput, ActionIcon, Indicator, Menu, Avatar, Button, Divider, Container } from "@mantine/core"
import { IconSearch, IconBell, IconMessageCircle2, IconHeart, IconPlus, IconLogout, IconSettings, IconLayoutDashboard, IconCar, IconUserPlus, IconGavel, IconTools, IconShieldCheck, IconHelpCircle } from "@tabler/icons-react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useColorScheme } from "@/components/providers/AppProviders"
import { IconSun, IconMoon } from "@tabler/icons-react"

export default function AppHeader() {
  const { data: session } = useSession()
  const [favCount, setFavCount] = useState(0)
  useEffect(() => {
    if (session) fetch("/api/favorites?countOnly=true").then(r => r.json()).then(d => setFavCount(d.count || 0)).catch(() => {})
  }, [session])
  const { colorScheme, toggleScheme } = useColorScheme()
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState("")

  const navigation = [
    { href: "/", label: "Объявления", icon: null, active: pathname === "/" || pathname.startsWith("/category") || pathname.startsWith("/search") },
    { href: "/parts-finder", label: "Запчасти", icon: <IconTools size={14} />, active: pathname.startsWith("/parts") },
    { href: "/auctions", label: "Аукционы", icon: <IconGavel size={14} />, active: pathname.startsWith("/auctions") },
    { href: "/services/safe-deal", label: "Сервисы", icon: <IconShieldCheck size={14} />, active: pathname.startsWith("/services") },
    { href: "/help", label: "Помощь", icon: <IconHelpCircle size={14} />, active: pathname.startsWith("/help") },
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <Box
      component="header"
      pos="sticky"
      top={0}
      className="market-app-header"
      style={{
        zIndex: 200,
        background: "var(--mantine-color-body)",
        borderBottom: "1px solid var(--mantine-color-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <Container size="xl" px={{ base: "sm", md: "md" }} style={{ height: "var(--app-header-height)" }}>
        <Group h="100%" gap="md" wrap="nowrap" align="center" justify="space-between">
          {/* ЛЕВО: Лого */}
          <Link href="/" style={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}>
            <Group gap={8} wrap="nowrap" align="center">
              <Box style={{
                width: 36, height: 36, borderRadius: 11,
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <IconCar size={19} color="white" />
              </Box>
              <Text ff="var(--font-display),sans-serif" fw={800} fz={18} lh={1} c="var(--mantine-color-text)" style={{ letterSpacing: "-0.025em" }}>
                Авторынок
              </Text>
            </Group>
          </Link>

          <Group gap={2} visibleFrom="lg" wrap="nowrap" className="market-app-header__links">
            {navigation.map((item) => (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                variant={item.active ? "light" : "subtle"}
                color={item.active ? "indigo" : "gray"}
                size="compact-sm"
                leftSection={item.icon}
                aria-current={item.active ? "page" : undefined}
                styles={{ root: { fontWeight: item.active ? 700 : 600 } }}
              >
                {item.label}
              </Button>
            ))}
          </Group>

          {/* ЦЕНТР: Поиск — максимальная ширина */}
          <Box component="form" onSubmit={handleSearch} style={{ flex: 1, maxWidth: 440 }} visibleFrom="sm">
            <TextInput
              placeholder="Марка, модель, город..."
              leftSection={<IconSearch size={16} color="gray.4" />}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              radius="md"
              size="sm"
              variant="filled"
              styles={{
                input: {
                  background: "var(--mantine-color-gray-1)",
                  border: "1px solid transparent",
                  height: 38,
                  transition: "all 200ms ease",
                },
              }}
            />
          </Box>

          {/* ПРАВО: Кнопки — разделены визуально */}
          <Group gap={6} wrap="nowrap" align="center">
            {/* Продать — яркая индиго */}
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              radius="md"
              onClick={toggleScheme}
              aria-label="Сменить тему"
            >
              {colorScheme === "dark" ? <IconSun size={18} stroke={1.8} /> : <IconMoon size={18} stroke={1.8} />}
            </ActionIcon>

            <ActionIcon component={Link} href="/search" variant="subtle" color="gray" size="md" radius="md" hiddenFrom="sm" aria-label="Открыть поиск">
              <IconSearch size={18} stroke={1.8} />
            </ActionIcon>

            <ActionIcon component={Link} href="/listings/create/vehicle" variant="light" color="indigo" size="md" radius="md" hiddenFrom="md" aria-label="Разместить объявление">
              <IconPlus size={18} stroke={1.8} />
            </ActionIcon>

            <Button
              component={Link}
              href="/listings/create/vehicle"
              leftSection={<IconPlus size={15} />}
              size="sm"
              radius="md"
              color="indigo"
              variant="filled"
              visibleFrom="md"
              styles={{ root: { height: 38, fontWeight: 700 } }}
            >
              Продать
            </Button>

            {session ? (
              <>
                <Indicator size={7} color="red" offset={4} disabled={favCount === 0}>
                  <ActionIcon component={Link} href="/favorites" variant="subtle" color="gray" size="lg" radius="md" aria-label="Избранное">
                    <IconHeart size={18} stroke={1.8} />
                  </ActionIcon>
                </Indicator>
                <Indicator size={7} color="violet" offset={4}>
                  <ActionIcon component={Link} href="/messages" variant="subtle" color="gray" size="lg" radius="md" aria-label="Сообщения">
                    <IconMessageCircle2 size={18} stroke={1.8} />
                  </ActionIcon>
                </Indicator>
                <Indicator size={7} color="red" offset={4}>
                  <ActionIcon component={Link} href="/notifications" variant="subtle" color="gray" size="lg" radius="md" aria-label="Уведомления">
                    <IconBell size={18} stroke={1.8} />
                  </ActionIcon>
                </Indicator>
                <Divider orientation="vertical" mx={2} h={26} />
                <Menu shadow="md" width={220} position="bottom-end" radius="md" offset={4}>
                  <Menu.Target>
                    <ActionIcon variant="subtle" radius="xl" size={32}>
                      <Avatar src={session.user?.image} size={28} radius="xl" color="indigo">
                        {session.user?.name?.[0]?.toUpperCase()}
                      </Avatar>
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Box px="sm" py={6}>
                      <Text size="sm" fw={600} c="dark.9" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {session.user?.name || session.user?.email}
                      </Text>
                    </Box>
                    <Menu.Divider />
                    <Menu.Item component={Link} href="/dashboard" leftSection={<IconLayoutDashboard size={15} />}>Личный кабинет</Menu.Item>
                    <Menu.Item component={Link} href="/favorites" leftSection={<IconHeart size={15} />}>Избранное</Menu.Item>
                    <Menu.Item component={Link} href="/dashboard" leftSection={<IconSettings size={15} />}>Настройки</Menu.Item>
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
                <Divider orientation="vertical" mx={2} h={26} />
                {/* Войти — subtle gray */}
                <Button component={Link} href="/auth/signin" variant="light" color="indigo" size="sm" radius="md" styles={{ root: { height: 38, fontWeight: 700 } }}>
                  Войти
                </Button>
                {/* Регистрация — outline indigo, отличается от «Войти» */}
                <Button component={Link} href="/auth/signup" variant="filled" color="indigo" size="sm" radius="md" visibleFrom="xs" styles={{ root: { height: 38, fontWeight: 700 } }}>
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
