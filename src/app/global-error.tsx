"use client"

import { useEffect } from "react"
import { Box, Button, Paper, Stack, Text, Title } from "@mantine/core"

/** Last-resort fallback that still works if the root application shell fails. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global application error", error)
  }, [error])

  return (
    <html lang="ru">
      <body>
        <Box component="main" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f7f9" }}>
          <Paper maw={520} w="100%" p={{ base: "xl", sm: 32 }} radius="xl" withBorder shadow="lg" ta="center">
            <Stack gap="sm" align="center">
              <Text size="sm" fw={800} c="indigo" lts={0.8}>АВТОРЫНОК</Text>
              <Title order={1} fz={{ base: 24, sm: 28 }} lh={1.15}>Временная ошибка приложения</Title>
              <Text c="dimmed" lh={1.55}>Обновите страницу или вернитесь к каталогу. Мы не показываем технические детали ошибки посетителям.</Text>
              <Box mt="md" style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                <Button type="button" onClick={reset} color="indigo">Повторить</Button>
                <Button component="a" href="/" variant="default">К объявлениям</Button>
              </Box>
            </Stack>
          </Paper>
        </Box>
      </body>
    </html>
  )
}
