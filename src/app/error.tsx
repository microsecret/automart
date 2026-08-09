"use client"

import { useEffect } from "react"
import { Box, Container } from "@mantine/core"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application route error", error)
  }, [error])

  return (
    <Container size="sm" py={{ base: 64, md: 112 }}>
      <Box>
        <AsyncErrorState
          title="Страница временно недоступна"
          description="Мы уже получили информацию об ошибке. Попробуйте открыть страницу ещё раз — ваши данные не потеряны."
          onRetry={reset}
          backHref="/"
        />
      </Box>
    </Container>
  )
}
