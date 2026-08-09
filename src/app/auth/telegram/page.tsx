import type { Metadata } from "next"
import Link from "next/link"
import { Box, Paper, Stack, Text, Title } from "@mantine/core"
import TelegramLoginForm from "@/components/auth/TelegramLoginForm"

export const metadata: Metadata = { title: "Вход через Telegram" }

export default function TelegramAuthPage() {
  return (
    <Box maw={460} mx="auto" py={{ base: "xl", md: 80 }} px="md">
      <Paper withBorder radius="lg" p={{ base: "lg", md: "xl" }}>
        <Stack gap="lg">
          <div>
            <Title order={1} fz={28}>Вход через Telegram</Title>
            <Text c="dimmed" mt="xs">Без пароля: подтверждаем номер через бота Авторынка.</Text>
          </div>
          <TelegramLoginForm />
          <Text size="sm" ta="center" c="dimmed">Нет аккаунта? <Link href="/auth/signup" style={{ color: "#4f46e5" }}>Зарегистрироваться</Link></Text>
        </Stack>
      </Paper>
    </Box>
  )
}
