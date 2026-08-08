"use client"

import { Box, Stack, Text, Button, Group, ThemeIcon } from "@mantine/core"
import { IconHome, IconSearch } from "@tabler/icons-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <Box style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Stack gap="md" align="center">
        <Text
          ff="var(--font-display),sans-serif"
          fw={800}
          fz={64}
          lh={1}
          c="#4f46e5"
          style={{ letterSpacing: "-0.04em" }}
        >
          404
        </Text>
        <Stack gap={4} align="center">
          <Text fw={600} fz="lg" c="#18181b">Страница не найдена</Text>
          <Text size="sm" c="#71717a">Возможно, страница была удалена или вы перешли по неверной ссылке</Text>
        </Stack>
        <Group gap="sm" mt="xs">
          <Button component={Link} href="/" leftSection={<IconHome size={16} />} color="indigo" radius="md" size="sm">
            На главную
          </Button>
          <Button component={Link} href="/search" variant="light" color="indigo" leftSection={<IconSearch size={16} />} radius="md" size="sm">
            Поиск
          </Button>
        </Group>
      </Stack>
    </Box>
  )
}
