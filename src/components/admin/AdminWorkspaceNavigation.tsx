"use client"

import { Button, Group, Paper, ScrollArea, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconBuildingWarehouse, IconChartBar, IconGavel, IconBrandTelegram, IconHeadset, IconLayoutDashboard, IconUsers, IconMessages, IconGasStation } from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const ADMIN_SECTIONS = [
  { href: "/admin", label: "Обзор", icon: IconLayoutDashboard, match: (pathname: string) => pathname === "/admin" },
  { href: "/admin/users", label: "Пользователи", icon: IconUsers, match: (pathname: string) => pathname.startsWith("/admin/users") },
  { href: "/moderation", label: "Модерация", icon: IconGavel, match: (pathname: string) => pathname.startsWith("/moderation") },
  { href: "/admin/auctions", label: "Аукционы", icon: IconGavel, match: (pathname: string) => pathname.startsWith("/admin/auctions") },
  { href: "/admin/partners", label: "Партнёры", icon: IconBuildingWarehouse, match: (pathname: string) => pathname.startsWith("/admin/partners") },
  { href: "/admin/support", label: "Поддержка", icon: IconHeadset, match: (pathname: string) => pathname.startsWith("/admin/support") },
  { href: "/admin/forum", label: "Форум", icon: IconMessages, match: (pathname: string) => pathname.startsWith("/admin/forum") },
  { href: "/admin/fuel", label: "АЗС и топливо", icon: IconGasStation, match: (pathname: string) => pathname.startsWith("/admin/fuel") },
  { href: "/admin/traffic", label: "Посещаемость", icon: IconChartBar, match: (pathname: string) => pathname.startsWith("/admin/traffic") },
  { href: "/admin/telegram", label: "Рассылка", icon: IconBrandTelegram, match: (pathname: string) => pathname.startsWith("/admin/telegram") },
]

type AdminWorkspaceNavigationProps = {
  canManageUsers?: boolean
}

/** Persistent workspace navigation so an administrator never has to return to the overview just to change context. */
export default function AdminWorkspaceNavigation({ canManageUsers = true }: AdminWorkspaceNavigationProps) {
  const pathname = usePathname() || ""
  const sections = canManageUsers ? ADMIN_SECTIONS : ADMIN_SECTIONS.filter((section) => section.href === "/moderation")

  return (
    <Paper withBorder radius="md" p="xs" mb="sm" className="admin-workspace-navigation" aria-label="Разделы администрирования">
      <Group justify="space-between" gap="sm" wrap="wrap" px="xs" pb={4}>
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon variant="light" color="grape" size={28} radius="md"><IconLayoutDashboard size={15} /></ThemeIcon>
          <Stack gap={0}>
            <Text size="xs" fw={800} tt="uppercase" c="dimmed">Рабочее пространство</Text>
            <Text size="xs" c="dimmed">Все ключевые очереди — в один переход</Text>
          </Stack>
        </Group>
      </Group>
      {/* Полоса прокрутки видима на телефоне.

        Десять разделов занимают около тысячи ста пикселей, на экране
        помещаются два с половиной. Скрытая полоса не подсказывала, что
        справа есть ещё восемь, — «Поддержка» и «Рассылка» выглядели
        отсутствующими вовсе. */}
      <ScrollArea type="auto" scrollbarSize={6} offsetScrollbars>
        <Group gap={6} wrap="nowrap" px="xs" pb={2}>
          {sections.map((section) => {
            const Icon = section.icon
            const active = section.match(pathname)
            return (
              <Button
                key={section.href}
                component={Link}
                href={section.href}
                variant={active ? "filled" : "subtle"}
                color={active ? "indigo" : "gray"}
                className="admin-workspace-navigation__item"
                data-active={active || undefined}
                size="xs"
                radius="md"
                leftSection={<Icon size={15} />}
                aria-current={active ? "page" : undefined}
              >
                {section.label}
              </Button>
            )
          })}
        </Group>
      </ScrollArea>
    </Paper>
  )
}
