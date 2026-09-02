import type { Metadata } from "next"
import Link from "next/link"
import { Alert, Box, Button, Paper, Stack, Text, Title } from "@mantine/core"

export const metadata: Metadata = { title: "Вход в аккаунт" }

export default function TelegramAuthPage() {
  return (
    <Box maw={460} mx="auto" py={{ base: "xl", md: 80 }} px="md">
      <Paper withBorder radius="md" p={{ base: "lg", md: "xl" }}>
        <Stack gap="lg">
          <div>
            <Title order={1} fz={28}>Вход в аккаунт</Title>
            <Text c="dimmed" mt="xs">На сайте вход выполняется по почте или телефону и паролю.</Text>
          </div>
          <Alert color="indigo" variant="light">
            Автоматический вход по Telegram ID работает внутри Mini App. Отдельная кнопка Telegram-входа на сайте больше не требуется.
          </Alert>
          <Button component={Link} href="/auth/signin" color="indigo" fullWidth>Войти по почте или телефону</Button>
          <Text size="sm" ta="center" c="dimmed">Нет аккаунта? <Link href="/auth/signup" style={{ color: "var(--market-primary)" }}>Регистрация через Telegram-бота</Link></Text>
        </Stack>
      </Paper>
    </Box>
  )
}
