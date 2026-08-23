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
import { DASHBOARD_NAVIGATION } from "@/lib/navigation-registry"
import styles from "./DashboardNav.module.css"

const ITEM_ICONS = {
  listings: IconTag,
  favorites: IconHeart,
  garage: IconCar,
  deliveries: IconTruckDelivery,
  documents: IconFileDescription,
  messages: IconMessageCircle2,
  payments: IconCreditCard,
  profile: IconSettings,
} satisfies Record<(typeof DASHBOARD_NAVIGATION)[number]["id"], typeof IconTag>

export default function DashboardNav({ active }: { active?: string }) {
  return (
    <Box component="nav" className={styles.nav} aria-label="Разделы личного кабинета">
      <Group gap={4} wrap="nowrap" className={styles.track}>
        {DASHBOARD_NAVIGATION.map((item) => {
          const Icon = ITEM_ICONS[item.id]
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
              <Text size="xs" fw={isActive ? 800 : 650}>{"shortLabel" in item ? item.shortLabel : item.label}</Text>
            </UnstyledButton>
          )
        })}
      </Group>
    </Box>
  )
}
