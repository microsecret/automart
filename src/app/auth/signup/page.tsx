"use client"
export const dynamic = "force-dynamic"
import { Container, Card, Stack, Text, Box, Group, ThemeIcon } from "@mantine/core"
import { IconCar, IconCheck } from "@tabler/icons-react"
import SignUpForm from "@/components/auth/SignUpForm"

const BENEFITS = [
  "Телефон, почта и пароль за 3 шага",
  "Доступ к проверке истории авто",
  "Сопровождение сделки и статусы покупки",
  "Сохранение избранных объявлений",
]

export default function SignUpPage() {
  return (
    <Container className="auth-experience" size="md" py={{ base: 24, sm: 48 }} px={{ base: "sm", sm: "md" }}>
      <Group className="auth-experience__layout" gap={48} align="center" wrap="nowrap" justify="center">
        {/* Преимущества */}
        <Stack className="auth-experience__context" gap="lg" visibleFrom="md" maw={300}>
          <Group gap="sm">
            <Box className="auth-experience__brand-mark">
              <IconCar size={24} color="white" />
            </Box>
            <Text fw={800} fz={24} c="var(--market-ink)" ff="var(--font-display),sans-serif">LeWheel</Text>
          </Group>
          <Text size="sm" c="gray.5" lh={1.6}>Создайте защищённый аккаунт через Telegram-бота за минуту.</Text>
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
        <Stack className="auth-experience__form-area" gap="lg" align="center" w="100%" maw={420} style={{ minWidth: 0 }}>
          <Stack gap={4} align="center">
            <Text component="h1" fw={800} fz={24} c="var(--market-ink)" ff="var(--font-display),sans-serif">Регистрация</Text>
            <Text size="sm" c="gray.5">Три шага в Telegram-боте</Text>
          </Stack>

          <Card className="auth-experience__form-card" withBorder radius="lg" p={{ base: "lg", sm: "xl" }} w="100%" maw={420} shadow="sm">
            <SignUpForm />
          </Card>

        </Stack>
      </Group>
    </Container>
  )
}
