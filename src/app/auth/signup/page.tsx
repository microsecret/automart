"use client"
export const dynamic = "force-dynamic"
import { Container, Card, Stack, Text, Box, Group, ThemeIcon, Alert } from "@mantine/core"
import { IconCar, IconCheck, IconInfoCircle } from "@tabler/icons-react"
import Link from "next/link"
import SignUpForm from "@/components/auth/SignUpForm"

const BENEFITS = [
  "Размещение объявлений бесплатно",
  "Доступ к проверке истории авто",
  "Безопасные сделки через эскроу",
  "Сохранение избранных объявлений",
]

export default function SignUpPage() {
  return (
    <Container size="md" py={48}>
      <Group gap={48} align="center" wrap="nowrap" justify="center">
        {/* Преимущества */}
        <Stack gap="lg" visibleFrom="md" maw={300}>
          <Group gap="sm">
            <Box style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconCar size={24} color="white" />
            </Box>
            <Text fw={800} fz={24} c="dark.9" ff="var(--font-display),sans-serif">Авторынок</Text>
          </Group>
          <Text size="sm" c="gray.5" lh={1.6}>Создайте бесплатный аккаунт за 30 секунд.</Text>
          <Stack gap="sm">
            {BENEFITS.map((b) => (
              <Group key={b} gap="sm">
                <ThemeIcon variant="light" color="green" size={28} radius="md"><IconCheck size={16} /></ThemeIcon>
                <Text size="sm" c="gray.6">{b}</Text>
              </Group>
            ))}
          </Stack>
        </Stack>

        {/* Форма */}
        <Stack gap="lg" align="center" maw={420} style={{ flexShrink: 0 }}>
          <Stack gap={4} align="center">
            <Text component="h1" fw={800} fz={24} c="dark.9" ff="var(--font-display),sans-serif">Регистрация</Text>
            <Text size="sm" c="gray.5">Бесплатно и быстро</Text>
          </Stack>

          <Card withBorder radius="lg" p="xl" w={420} shadow="sm">
            <SignUpForm />
          </Card>

          <Text size="xs" c="gray.5">
            Уже есть аккаунт? <Link href="/auth/signin" style={{ color: "#4f46e5", fontWeight: 600 }}>Войти</Link>
          </Text>
        </Stack>
      </Group>
    </Container>
  )
}
