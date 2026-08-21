"use client"

import { useState } from "react"
import Link from "next/link"
import { Box, Button, Group, Paper, Skeleton, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconAlertCircle, IconArrowLeft, IconRefresh, IconSearchOff } from "@tabler/icons-react"

type AsyncErrorStateProps = {
  title?: string
  description?: string
  onRetry?: () => void | Promise<unknown>
  backHref?: string
  backLabel?: string
}

export function AsyncErrorState({
  title = "Не удалось загрузить данные",
  description = "Проверьте подключение к интернету и попробуйте ещё раз.",
  onRetry,
  backHref,
  backLabel = "Вернуться к объявлениям",
}: AsyncErrorStateProps) {
  // Повтор без обратной связи выглядел как «кнопка не сработала»: запрос
  // уходит, а на экране ничего не меняется, и человек жмёт ещё раз.
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    if (!onRetry || retrying) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Paper radius="lg" p={{ base: "lg", md: "xl" }} withBorder>
      {/* role="alert" — экранный диктор объявляет ошибку сразу, а не когда
          человек доберётся до этого места табуляцией. */}
      <Stack align="center" gap="sm" maw={480} mx="auto" ta="center" role="alert">
        <ThemeIcon size={52} radius="xl" color="red" variant="light"><IconAlertCircle size={27} /></ThemeIcon>
        <Text fw={750} fz="lg">{title}</Text>
        <Text size="sm" c="dimmed">{description}</Text>
        <Group justify="center" gap="xs" mt="xs">
          {onRetry && (
            <Button
              color="indigo"
              size="sm"
              leftSection={<IconRefresh size={15} />}
              onClick={() => void handleRetry()}
              loading={retrying}
            >
              {retrying ? "Обновляем" : "Повторить"}
            </Button>
          )}
          {backHref && <Button component={Link} href={backHref} variant="light" color="gray" size="sm" leftSection={<IconArrowLeft size={15} />}>{backLabel}</Button>}
        </Group>
      </Stack>
    </Paper>
  )
}

type EmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export function EmptyState({ title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <Paper radius="lg" p={{ base: "lg", md: "xl" }} withBorder>
      <Stack align="center" gap="sm" maw={480} mx="auto" ta="center">
        <ThemeIcon size={52} radius="xl" color="gray" variant="light"><IconSearchOff size={26} /></ThemeIcon>
        <Text fw={750} fz="lg">{title}</Text>
        <Text size="sm" c="dimmed">{description}</Text>
        {actionLabel && actionHref && <Button component={Link} href={actionHref} variant="light" color="indigo" size="sm" mt="xs">{actionLabel}</Button>}
        {actionLabel && onAction && <Button variant="light" color="indigo" size="sm" mt="xs" onClick={onAction}>{actionLabel}</Button>}
      </Stack>
    </Paper>
  )
}

export function ResultsGridSkeleton({ count = 8, mediaHeight = 210 }: { count?: number; mediaHeight?: number }) {
  return (
    // role="status" с aria-live: диктор произносит «Загружаем объявления»
    // один раз и не перебивает человека. Без него о загрузке узнавали только
    // зрячие — aria-busy сам по себе ничего не озвучивает.
    <Box
      role="status"
      aria-live="polite"
      aria-label="Загружаем объявления"
      aria-busy="true"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}
    >
      {Array.from({ length: count }, (_, index) => (
        <Paper key={index} radius="lg" p={0} withBorder style={{ overflow: "hidden" }}>
          <Skeleton height={mediaHeight} radius={0} />
          <Stack gap={8} p="sm">
            <Skeleton height={18} width="52%" />
            <Skeleton height={13} width="86%" />
            <Skeleton height={13} width="68%" />
            <Skeleton height={12} width="100%" mt={4} />
          </Stack>
        </Paper>
      ))}
    </Box>
  )
}
