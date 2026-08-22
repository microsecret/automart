"use client"
export const dynamic = "force-dynamic"
import Link from "next/link"
import { Box, Text, Paper, Group, Stack, ThemeIcon, SimpleGrid, Anchor } from "@mantine/core"
import { IconShieldCheck, IconHelpCircle, IconScale, IconMessage2, IconCar, IconLock } from "@tabler/icons-react"

const SECTIONS = [
  { icon: IconCar, title: "Как продать авто", desc: "Пошаговое руководство для продавцов", href: "/help/sell", color: "#1c4291" },
  { icon: IconShieldCheck, title: "Сопровождение сделки", desc: "Проверка документов, статусы и сопровождение покупки", href: "/services/safe-deal", color: "#059669" },
  { icon: IconLock, title: "Безопасность", desc: "Как защититься от мошенников", href: "/help/safety", color: "#dc2626" },
  { icon: IconScale, title: "Правила площадки", desc: "Условия использования, модерация", href: "/help/rules", color: "#1c4291" },
  { icon: IconMessage2, title: "Поддержка", desc: "Связаться с командой поддержки", href: "/help/support", color: "#ea580c" },
  { icon: IconHelpCircle, title: "Частые вопросы", desc: "Ответы на популярные вопросы", href: "/help/support", color: "#0891b2" },
]

export default function HelpPage() {
  return (
    <Box p={{ base: "sm", md: "lg" }}>
      <Stack gap="lg" maw={1000} mx="auto">
        <Box>
          <Text component="h1" ff="var(--font-display),sans-serif" c="var(--market-ink)" mb={4}>Помощь и поддержка</Text>
          <Text size="md" c="#64748b">Помощь по объявлениям, безопасности и сделкам на LeWheel</Text>
        </Box>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <Link key={s.title} href={s.href} style={{ textDecoration: "none" }}>
                {/* Прежний JS-hover двигал карточку через transform, которого не было
                    в transition: подъём происходил рывком, а на тач-экране подсветка
                    залипала, потому что mouseleave после тапа не приходит. */}
                <Paper p="lg" radius="md" withBorder className="market-linked-card" style={{ cursor: "pointer", height: "100%" }}>
                  <Group gap="md" align="flex-start">
                    <ThemeIcon size={44} radius="md" style={{ background: s.color }}>
                      <Icon size={22} color="white" />
                    </ThemeIcon>
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Text fw={700} fz="md" c="var(--market-ink)">{s.title}</Text>
                      <Text size="sm" c="#64748b">{s.desc}</Text>
                    </Stack>
                  </Group>
                </Paper>
              </Link>
            )
          })}
        </SimpleGrid>
        <Paper p="xl" radius="md" style={{ background: "linear-gradient(135deg,#1c4291,#1c4291)" }}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={0}>
              <Text fw={800} fz="lg" c="white">Не нашли ответ?</Text>
              <Text size="sm" c="rgba(255,255,255,0.85)">Создайте обращение — ответ появится в личном кабинете</Text>
            </Stack>
            <Anchor href="/help/support" c="white" fw={700} style={{ textDecoration: "underline" }}>Написать в поддержку →</Anchor>
          </Group>
        </Paper>
      </Stack>
    </Box>
  )
}
