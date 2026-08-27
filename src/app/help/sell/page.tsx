import { Box, Stack, Title, Text, Card, Group, ThemeIcon, SimpleGrid, Button } from "@mantine/core"
import { IconCamera, IconTag, IconCheck, IconTrendingUp, IconShieldCheck } from "@tabler/icons-react"
import Link from "next/link"

const STEPS = [
  { icon: <IconCamera size={20} />, title: "Сделайте фото", desc: "5-10 качественных фото с разных ракурсов" },
  { icon: <IconTag size={20} />, title: "Заполните данные", desc: "Укажите марку, модель, год, пробег, состояние" },
  { icon: <IconCheck size={20} />, title: "Опубликуйте", desc: "Объявление появится в поиске сразу после публикации" },
  { icon: <IconTrendingUp size={20} />, title: "Отвечайте быстро", desc: "Быстрые ответы = больше шансов на продажу" },
]

export default function HelpSellPage() {
  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 700, margin: "0 auto" }}>
      <Stack gap="md">
        <Title order={1} size="h3" ff="var(--font-display),sans-serif">Как продать авто</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {STEPS.map((s, i) => (
            <Card key={i} withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm" align="flex-start">
                <ThemeIcon variant="light" color="indigo" size={36} radius="md">{s.icon}</ThemeIcon>
                <Stack gap={2}><Text size="xs" c="gray.4">Шаг {i + 1}</Text><Text size="sm" fw={600} c="var(--market-ink)">{s.title}</Text><Text size="xs" c="gray.5">{s.desc}</Text></Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
        <Card withBorder radius="md" p="md" style={{ borderColor: "var(--market-info-line)", background: "var(--market-info-surface)" }}>
          <Group gap="sm" align="center">
            <ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconShieldCheck size={18} /></ThemeIcon>
            <Stack gap={0} style={{ flex: 1 }}>
              <Text size="sm" fw={600}>Готовы продать?</Text>
              <Text size="xs" c="gray.5">Размещение бесплатно</Text>
            </Stack>
            <Button component={Link} href="/listings/create/vehicle" color="indigo" size="sm" radius="md">Разместить</Button>
          </Group>
        </Card>
      </Stack>
    </Box>
  )
}
