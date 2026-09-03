"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Box, Group, Text, ThemeIcon, UnstyledButton } from "@mantine/core"
import {
  IconBell,
  IconCar,
  IconCreditCard,
  IconFileDescription,
  IconHeart,
  IconMessageCircle2,
  IconSearch,
  IconSettings,
  IconTag,
  IconTruckDelivery,
} from "@tabler/icons-react"
import { DASHBOARD_NAVIGATION } from "@/lib/navigation-registry"
import styles from "./DashboardNav.module.css"

const ITEM_ICONS = {
  listings: IconTag,
  favorites: IconHeart,
  garage: IconCar,
  "part-requests": IconSearch,
  deliveries: IconTruckDelivery,
  documents: IconFileDescription,
  messages: IconMessageCircle2,
  subscriptions: IconBell,
  payments: IconCreditCard,
  profile: IconSettings,
} satisfies Record<(typeof DASHBOARD_NAVIGATION)[number]["id"], typeof IconTag>

/**
 * Какой раздел кабинета открыт.
 *
 * Определяется по адресу, а не передаётся свойством: так полоса живёт в
 * общей раскладке и её нельзя забыть, добавляя новую страницу.
 */
function resolveActiveId(pathname: string, tab: string | null): string | undefined {
  if (pathname.startsWith("/dashboard/deliveries")) return "deliveries"
  if (pathname.startsWith("/dashboard/documents")) return "documents"
  if (pathname.startsWith("/favorites")) return "favorites"
  if (pathname.startsWith("/messages")) return "messages"
  if (pathname !== "/dashboard") return undefined

  // Разделы самой страницы кабинета живут в строке запроса.
  if (tab === "garage" || tab === "payments" || tab === "profile") return tab
  return "listings"
}

export default function DashboardNav({ active }: { active?: string }) {
  /* Граница Suspense внутри компонента, а не на страницах.

     Чтение строки запроса её требует, иначе сборка падает. Ставить её
     на каждой странице, где полоса используется, — значит однажды
     забыть: так и вышло с избранным. */
  return (
    <Suspense fallback={<NavTrack activeId={active} />}>
      <NavWithLocation active={active} />
    </Suspense>
  )
}

function NavWithLocation({ active }: { active?: string }) {
  const pathname = usePathname() || ""
  const tab = useSearchParams().get("tab")
  return <NavTrack activeId={active ?? resolveActiveId(pathname, tab)} />
}

function NavTrack({ activeId }: { activeId?: string }) {
  return (
    <Box component="nav" className={styles.nav} aria-label="Разделы личного кабинета">
      <Group gap={4} wrap="nowrap" className={styles.track}>
        {DASHBOARD_NAVIGATION.map((item) => {
          const Icon = ITEM_ICONS[item.id]
          const isActive = activeId === item.id
          return (
            <UnstyledButton
              key={item.id}
              component={Link}
              href={item.href}
              className={styles.item}
              data-active={isActive || undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <ThemeIcon size={30} radius="md" variant={isActive ? "filled" : "light"} color="indigo">
                <Icon size={16} stroke={1.9} />
              </ThemeIcon>
              <Text size="xs" fw={isActive ? 800 : 650}>{"shortLabel" in item ? item.shortLabel : item.label}</Text>
            </UnstyledButton>
          )
        })}
      </Group>
    </Box>
  )
}
