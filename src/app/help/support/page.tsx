"use client"
export const dynamic = "force-dynamic"
import { Box, Stack, Title, Text, Card, ThemeIcon, Group, Button, SimpleGrid } from "@mantine/core"
import { IconHeadset, IconMail, IconMessageCircle2, IconPhone, IconClock } from "@tabler/icons-react"

export default function HelpSupportPage() {
  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 600, margin: "0 auto" }}>
      <Stack gap="md">
        <Title order={2} size="h3" ff="var(--font-display),sans-serif">Поддержка</Title>
        <Text size="sm" c="gray.5">Мы готовы помочь вам 24/7</Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
            <Stack gap="sm" align="center" ta="center">
              <ThemeIcon variant="light" color="indigo" size={40} radius="md"><IconHeadset size={20} /></ThemeIcon>
              <Text size="sm" fw={600}>Онлайн-чат</Text>
              <Text size="xs" c="gray.5">Нажмите кнопку поддержки в правом нижнем углу</Text>
              <Text size="xs" c="#16a34a" fw={600}>⚡ Ответ за минуты</Text>
            </Stack>
          </Card>
          <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
            <Stack gap="sm" align="center" ta="center">
              <ThemeIcon variant="light" color="blue" size={40} radius="md"><IconMail size={20} /></ThemeIcon>
              <Text size="sm" fw={600}>Email</Text>
              <Text size="xs" c="gray.5">support@avtorynok.ru</Text>
              <Text size="xs" c="gray.4">Ответ в течение 24 часов</Text>
            </Stack>
          </Card>
        </SimpleGrid>

        <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
          <Group gap="sm">
            <ThemeIcon variant="light" color="green" size={32} radius="md"><IconClock size={16} /></ThemeIcon>
            <Stack gap={0}>
              <Text size="sm" fw={500}>Режим работы</Text>
              <Text size="xs" c="gray.5">Онлайн-чат: круглосуточно · Email: Пн-Пт 9:00-21:00</Text>
            </Stack>
          </Group>
        </Card>
      </Stack>
    </Box>
  )
}
