"use client"

import { Box, Group, Text, TextInput, ActionIcon, Indicator, Menu, Avatar, Button, Divider, Container } from "@mantine/core"
import { IconSearch, IconBell, IconMessageCircle2, IconHeart, IconPlus, IconLogout, IconSettings, IconLayoutDashboard, IconCar } from "@tabler/icons-react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useColorScheme } from "@/components/providers/AppProviders"
import { IconSun, IconMoon } from "@tabler/icons-react"

interface AppHeaderProps {
  onBurgerClick?: () => void
  showBurger?: boolean
}

export default function AppHeader(_props: AppHeaderProps = {}) {
  const { data: session } = useSession()
  const { colorScheme, toggleScheme } = useColorScheme()
  const router = useRouter()
  const [query, setQuery] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <Box
      component="header"
      pos="sticky"
      top={0}
      style={{
        zIndex: 200,
        height: 56,
        background: "var(--mantine-color-body)",
        borderBottom: "1px solid var(--mantine-color-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <Container size="xl" h={56} px={{ base: "sm", md: "md" }}>
        {/* Единая строка — все в одну линию */}
        <Group h={56} gap="md" wrap="nowrap" align="center" justify="space-between">
          {/* ЛЕВО: Лого */}
          <Link href="/" style={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}>
            <Group gap={8} wrap="nowrap" align="center">
              <Box style={{
                width: 32, height: 32, borderRadius: 8,
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <IconCar size={18} color="white" />
              </Box>
              <Text ff="var(--font-display),sans-serif" fw={800} fz={17} lh={1} c="var(--mantine-color-text)" style={{ letterSpacing: "-0.02em" }}>
                Авторынок
              </Text>
            </Group>
          </Link>

          {/* ЦЕНТР: Поиск — максимальная ширина */}
          <Box component="form" onSubmit={handleSearch} style={{ flex: 1, maxWidth: 520 }} visibleFrom="sm">
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
                  height: 36,
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

            <Button
              component={Link}
              href="/listings/create/vehicle"
              leftSection={<IconPlus size={15} />}
              size="sm"
              radius="md"
              color="indigo"
              variant="filled"
              visibleFrom="md"
              styles={{ root: { height: 34, fontWeight: 600 } }}
            >
              Продать
            </Button>

            {session ? (
              <>
                <ActionIcon component={Link} href="/favorites" variant="subtle" color="gray" size="md" radius="md" aria-label="Избранное">
                  <IconHeart size={18} stroke={1.8} />
                </ActionIcon>
                <Indicator size={7} color="violet" offset={4}>
                  <ActionIcon component={Link} href="/messages" variant="subtle" color="gray" size="md" radius="md" aria-label="Сообщения">
                    <IconMessageCircle2 size={18} stroke={1.8} />
                  </ActionIcon>
                </Indicator>
                <Indicator size={7} color="red" offset={4}>
                  <ActionIcon component={Link} href="/notifications" variant="subtle" color="gray" size="md" radius="md" aria-label="Уведомления">
                    <IconBell size={18} stroke={1.8} />
                  </ActionIcon>
                </Indicator>
                <Divider orientation="vertical" mx={2} h={24} />
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
                    <Menu.Divider />
                    <Menu.Item leftSection={<IconLogout size={15} />} onClick={() => signOut({ callbackUrl: "/" })} color="red">Выйти</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </>
            ) : (
              <>
                <Divider orientation="vertical" mx={2} h={24} />
                {/* Войти — subtle gray */}
                <Button component={Link} href="/auth/signin" variant="subtle" color="gray" size="sm" radius="md" styles={{ root: { height: 34, fontWeight: 600 } }}>
                  Войти
                </Button>
                {/* Регистрация — outline indigo, отличается от «Войти» */}
                <Button component={Link} href="/auth/signup" variant="light" color="indigo" size="sm" radius="md" visibleFrom="xs" styles={{ root: { height: 34, fontWeight: 600 } }}>
                  Регистрация
                </Button>
              </>
            )}
          </Group>
        </Group>
      </Container>
    </Box>
  )
}
