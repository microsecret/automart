import SectionArtworkHeader from "@/components/ui/SectionArtworkHeader"
import ServiceArtwork from "@/components/ui/ServiceArtwork"
import { Box, Stack, Text, Card, Group, SimpleGrid, Button } from "@mantine/core"
import Link from "next/link"

const STEPS = [
  { art: "history-check" as const, title: "Сделайте фото", desc: "5-10 качественных фото с разных ракурсов" },
  { art: "documents" as const, title: "Заполните данные", desc: "Укажите марку, модель, год, пробег, состояние" },
  { art: "publish-listing" as const, title: "Опубликуйте", desc: "Объявление появится в поиске сразу после публикации" },
  { art: "messages" as const, title: "Отвечайте быстро", desc: "Быстрые ответы = больше шансов на продажу" },
]

export default function HelpSellPage() {
  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 700, margin: "0 auto" }}>
      <Stack gap="md">
        <SectionArtworkHeader scene="sell" title="Как продать авто" />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {STEPS.map((s, i) => (
            <Card key={i} withBorder radius="md" p="md" style={{ borderColor: "var(--market-line)" }}>
              <Group gap="sm" align="flex-start" wrap="nowrap" data-help-step={i}>
                <ServiceArtwork kind={s.art} size={44} />
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}><Text size="xs" c="var(--market-muted)">Шаг {i + 1}</Text><Text size="sm" fw={600} c="var(--market-ink)">{s.title}</Text><Text size="xs" c="var(--market-muted)">{s.desc}</Text></Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
        <Card withBorder radius="md" p="md" style={{ borderColor: "var(--market-info-line)", background: "var(--market-primary-soft)" }}>
          <Group gap="sm" align="center">
            <ServiceArtwork kind="publish-listing" size={44} />
            <Stack gap={0} style={{ flex: 1 }}>
              <Text size="sm" fw={600}>Готовы продать?</Text>
              <Text size="xs" c="var(--market-muted)">Размещение бесплатно</Text>
            </Stack>
            <Button component={Link} href="/listings/create/vehicle" color="indigo" size="sm">Разместить</Button>
          </Group>
        </Card>
      </Stack>
    </Box>
  )
}
