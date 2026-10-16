import { Badge, Box, Button, Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconArrowRight, IconMapPin, IconRoute } from "@tabler/icons-react"
import Link from "next/link"
import ServiceArtwork from "@/components/ui/ServiceArtwork"

const SERVICES = [
  { href: "/services/valuation", title: "Оценка стоимости", description: "Ориентир по рынку перед покупкой или продажей.", artwork: "valuation", stage: "Сравнить рынок" },
  { href: "/services/history-check", title: "Проверка истории", description: "Заявка на проверку VIN и ключевых ограничений.", artwork: "history-check", stage: "Проверить VIN" },
  { href: "/services/smart-matching", title: "Умный подбор", description: "Подбор транспорта по бюджету и параметрам.", artwork: "matching", stage: "Подобрать авто" },
  { href: "/services/safe-deal", title: "Безопасная сделка", description: "Прозрачный сценарий оплаты и документов.", artwork: "safe-deal", stage: "Провести сделку" },
  { href: "/services/legal-documents", title: "Документы сделки", description: "Чек-листы для ДКП и акта приёма-передачи техники.", artwork: "documents", stage: "Подготовить" },
  { href: "/services/fuel-map", title: "Карта АЗС", description: "Где сейчас есть топливо и почём — по отметкам водителей.", artwork: "fuel-map", stage: "Найти заправку" },
] as const

export default function ServicesPage() {
  return <Box className="service-page" p={{ base: "sm", md: "md" }}>
    <Stack gap="lg">
      <Paper className="service-hub-hero" radius="xl" p={{ base: "lg", md: "xl" }} withBorder>
        <Group justify="space-between" align="flex-end" gap="lg" wrap="wrap">
          <Stack gap="xs" maw={660}>
            <Group gap="sm"><ThemeIcon size={42} radius="md" variant="white"><IconMapPin size={21} /></ThemeIcon><Badge variant="white" color="dark" radius="xl">Сервисы для выбора и сделки</Badge></Group>
            {/* Цвет задан явно: без него заголовок берёт тёмный --market-ink
                из общего правила заголовков страницы и оказывается
                тёмно-синим на тёмно-синей подложке — на живом сайте фраза
                была почти не видна. */}
            <Text component="h1" c="#fff" ff="var(--font-display),sans-serif">Решения, которые помогают принять решение увереннее.</Text>
            <Text size="sm" c="rgba(255,255,255,0.8)" maw={590}>Проверьте историю, сопоставьте цену, выберите маршрут и ведите сделку в одном понятном сценарии.</Text>
          </Stack>
          <Button component={Link} href="/services/fuel-map" variant="white" color="dark" size="sm" leftSection={<IconRoute size={16} />}>Открыть карту АЗС</Button>
        </Group>
      </Paper>

      <Group gap="sm" align="center">
        <ThemeIcon size={38} radius="md" variant="light" color="indigo"><IconMapPin size={19} /></ThemeIcon>
        <Box><Text fw={800} fz="lg">Выберите следующий шаг</Text><Text size="sm" c="dimmed">Каждый сервис ведёт к конкретному действию, а не к пустой справочной странице.</Text></Box>
      </Group>

      <Box className="lw-service-grid">
        {SERVICES.map((service) => {
          return <Paper key={service.href} component={Link} href={service.href} withBorder radius="md" className="service-card lw-service-widget">
            <Box className="lw-service-widget__copy">
              <Box><Text fw={800} fz="lg">{service.title}</Text><Text size="sm" c="dimmed" mt={6} lh={1.45}>{service.description}</Text></Box>
              <span className="lw-widget-action">{service.stage}<IconArrowRight size={15} aria-hidden="true" /></span>
            </Box>
            <ServiceArtwork kind={service.artwork} size={128} />
          </Paper>
        })}
      </Box>
    </Stack>
  </Box>
}
