"use client"
export const dynamic = "force-dynamic"
import { Box, Stack, Title, Text, Card, ThemeIcon, Group } from "@mantine/core"
import { IconCheck, IconX } from "@tabler/icons-react"

const ALLOWED = ["Реальные фото вашего авто", "Достоверные характеристики", "Один автомобиль = одно объявление", "Актуальная цена и наличие"]
const FORBIDDEN = ["Фейковые или чужие фото", "Скрученный пробег", "Дубликаты объявлений", "Спам и реклама", "Мошеннические схемы", "Завышенная цена для перекупов"]

export default function HelpRulesPage() {
  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 700, margin: "0 auto" }}>
      <Stack gap="md">
        <Title order={2} size="h3" ff="var(--font-display),sans-serif">Правила площадки</Title>
        <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
          <Stack gap="xs">
            <Text size="sm" fw={600} c="#16a34a">✓ Разрешено</Text>
            {ALLOWED.map((item) => <Group key={item} gap={6}><IconCheck size={14} color="#16a34a" /><Text size="xs" c="gray.6">{item}</Text></Group>)}
          </Stack>
        </Card>
        <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
          <Stack gap="xs">
            <Text size="sm" fw={600} c="#dc2626">✗ Запрещено</Text>
            {FORBIDDEN.map((item) => <Group key={item} gap={6}><IconX size={14} color="#dc2626" /><Text size="xs" c="gray.6">{item}</Text></Group>)}
          </Stack>
        </Card>
        <Text size="xs" c="gray.4">Нарушение правил ведёт к блокировке аккаунта и объявлений.</Text>
      </Stack>
    </Box>
  )
}
