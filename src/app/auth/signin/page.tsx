"use client"
export const dynamic = "force-dynamic"
import { Container, Card, Stack, Text, Box, Group, ThemeIcon } from "@mantine/core"
import { IconCar, IconShieldCheck, IconChartBar, IconBell } from "@tabler/icons-react"
import SignInForm from "@/components/auth/SignInForm"

const FEATURES = [
  { icon: IconShieldCheck, text: "Безопасные сделки с эскроу" },
  { icon: IconChartBar, text: "Продвижение объявлений" },
  { icon: IconBell, text: "Уведомления и сообщения" },
]

export default function SignInPage() {
  return (
    <Container size="md" py={48}>
      <Group gap={48} align="center" wrap="nowrap" justify="center">
        {/* Левая колонка — преимущества (десктоп) */}
        <Stack gap="lg" visibleFrom="md" maw={300}>
          <Group gap="sm">
            <Box style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconCar size={24} color="white" />
            </Box>
            <Text fw={800} fz={24} c="dark.9" ff="var(--font-display),sans-serif">Авторынок</Text>
          </Group>
          <Text size="sm" c="gray.5" lh={1.6}>Маркетплейс транспорта и запчастей с проверкой истории и безопасными сделками.</Text>
          <Stack gap="sm">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <Group key={f.text} gap="sm">
                  <ThemeIcon variant="light" color="indigo" size={32} radius="md"><Icon size={18} /></ThemeIcon>
                  <Text size="sm" c="gray.6">{f.text}</Text>
                </Group>
              )
            })}
          </Stack>
        </Stack>

        {/* Правая колонка — форма */}
        <Stack gap="lg" align="center" maw={420} style={{ flexShrink: 0 }}>
          <Stack gap={4} align="center">
            <Text component="h1" fw={800} fz={24} c="dark.9" ff="var(--font-display),sans-serif">Вход в аккаунт</Text>
            <Text size="sm" c="gray.5">Войдите, чтобы управлять объявлениями</Text>
          </Stack>

          <Card withBorder radius="lg" p="xl" w={420} shadow="sm">
            <SignInForm />
          </Card>
        </Stack>
      </Group>
    </Container>
  )
}
