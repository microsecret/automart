"use client"

import Link from "next/link"
import { Box, Group, Text, ThemeIcon, UnstyledButton } from "@mantine/core"
import {
  IconCar,
  IconCreditCard,
  IconFileDescription,
  IconHeart,
  IconMessageCircle2,
  IconSettings,
  IconTag,
  IconTruckDelivery,
} from "@tabler/icons-react"
import styles from "./DashboardNav.module.css"

const ITEMS = [
  { id: "listings", label: "Объявления", href: "/dashboard", icon: IconTag },
  { id: "favorites", label: "Избранное", href: "/favorites", icon: IconHeart },
  { id: "garage", label: "Гараж", href: "/dashboard?tab=garage", icon: IconCar },
  { id: "deliveries", label: "Доставки", href: "/dashboard/deliveries", icon: IconTruckDelivery },
  { id: "documents", label: "Документы", href: "/dashboard/documents", icon: IconFileDescription },
  { id: "messages", label: "Сообщения", href: "/messages", icon: IconMessageCircle2 },
  { id: "payments", label: "Оплаты", href: "/dashboard?tab=payments", icon: IconCreditCard },
  { id: "profile", label: "Профиль", href: "/dashboard?tab=profile", icon: IconSettings },
] as const

export default function DashboardNav({ active }: { active?: string }) {
  return (
    <Box component="nav" className={styles.nav} aria-label="Разделы личного кабинета">
      <Group gap={4} wrap="nowrap" className={styles.track}>
        {ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
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
              <Text size="xs" fw={isActive ? 800 : 650}>{item.label}</Text>
            </UnstyledButton>
          )
        })}
      </Group>
    </Box>
  )
}
