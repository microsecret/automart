"use client"

export const dynamic = "force-dynamic"

import { Box, Stack, Title, Text, Card, Group, Button, SimpleGrid, ThemeIcon, Badge } from "@mantine/core"
import { IconFlame, IconStar, IconEye, IconArrowUp } from "@tabler/icons-react"

const PROMO_OPTIONS = [
  { id: "boost", title: "Поднятие в топ", desc: "Объявление поднимется на первое место в поиске на 3 дня", price: 499, icon: <IconArrowUp size={20} />, color: "blue", duration: "3 дня" },
  { id: "premium", title: "Премиум-объявление", desc: "Выделение цветом, бейдж «Премиум», приоритет в выдаче на 7 дней", price: 1490, icon: <IconFlame size={20} />, color: "orange", duration: "7 дней" },
  { id: "vip", title: "VIP-размещение", desc: "Закрепление на главной странице + топ поиска + бейдж VIP на 30 дней", price: 3990, icon: <IconStar size={20} />, color: "violet", duration: "30 дней" },
]

export default function PromotePage({ params }: { params: { id: string } }) {
  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 700, margin: "0 auto" }}>
      <Stack gap="md">
        <Stack gap={0}>
          <Title order={2} size="h3" ff="var(--font-display),sans-serif">Продвижение объявления</Title>
          <Text size="xs" c="#71717a">ID: {params.id}</Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          {PROMO_OPTIONS.map((opt) => (
            <Card key={opt.id} withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
              <Stack gap="sm" align="center" ta="center">
                <ThemeIcon variant="light" color={opt.color} size={44} radius="md">{opt.icon}</ThemeIcon>
                <Text size="sm" fw={600} c="#18181b">{opt.title}</Text>
                <Text size="xs" c="#71717a" lh={1.4}>{opt.desc}</Text>
                <Badge variant="light" color={opt.color} size="sm">{opt.duration}</Badge>
                <Text size="lg" fw={800} c="#18181b" ff="var(--font-display),sans-serif">{opt.price} ₽</Text>
                <Button variant="light" color={opt.color} size="sm" radius="md" fullWidth>Выбрать</Button>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Card withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5", background: "#fafafa" }}>
          <Text size="xs" c="#71717a" ta="center">Демо-режим. Оплата через Stripe будет подключена позже.</Text>
        </Card>
      </Stack>
    </Box>
  )
}
