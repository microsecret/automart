import { Anchor, Badge, Box, Button, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconArrowRight, IconBrain, IconChartBar, IconFileDescription, IconFileSearch, IconGasStation, IconMapPin, IconRoute, IconShieldCheck } from "@tabler/icons-react"
import Link from "next/link"

const SERVICES = [
  { href: "/services/valuation", title: "Оценка стоимости", description: "Ориентир по рынку перед покупкой или продажей.", icon: IconChartBar, color: "indigo", stage: "Сравнить рынок" },
  { href: "/services/history-check", title: "Проверка истории", description: "Заявка на проверку VIN и ключевых ограничений.", icon: IconFileSearch, color: "cyan", stage: "Проверить VIN" },
  { href: "/services/smart-matching", title: "Умный подбор", description: "Подбор транспорта по бюджету и параметрам.", icon: IconBrain, color: "violet", stage: "Подобрать авто" },
  { href: "/services/safe-deal", title: "Безопасная сделка", description: "Прозрачный сценарий оплаты и документов.", icon: IconShieldCheck, color: "teal", stage: "Провести сделку" },
  { href: "/services/legal-documents", title: "Документы сделки", description: "Чек-листы для ДКП и акта приёма-передачи техники.", icon: IconFileDescription, color: "grape", stage: "Подготовить" },
  { href: "/services/fuel-map", title: "Карта АЗС", description: "АЗС по городам и трассам России — с маршрутами и данными поставщиков.", icon: IconGasStation, color: "orange", stage: "Найти заправку" },
]

export default function ServicesPage() {
  return <Box className="service-page" p={{ base: "sm", md: "md" }}>
    <Stack gap="lg">
      <Paper className="service-hub-hero" radius="xl" p={{ base: "lg", md: "xl" }} withBorder>
        <Group justify="space-between" align="flex-end" gap="lg" wrap="wrap">
          <Stack gap="xs" maw={660}>
            <Group gap="sm"><ThemeIcon size={42} radius="md" variant="white"><IconMapPin size={21} /></ThemeIcon><Badge variant="white" color="dark" radius="xl">Сервисы для выбора и сделки</Badge></Group>
            <Text component="h1" fw={850} fz={{ base: 28, md: 38 }} lh={1.08} ff="var(--font-display),sans-serif">Решения, которые помогают принять решение увереннее.</Text>
            <Text size="sm" c="rgba(255,255,255,0.8)" maw={590}>Проверьте историю, сопоставьте цену, выберите маршрут и ведите сделку в одном понятном сценарии.</Text>
          </Stack>
          <Button component={Link} href="/services/fuel-map" variant="white" color="dark" radius="md" size="sm" leftSection={<IconRoute size={16} />}>Открыть карту АЗС</Button>
        </Group>
      </Paper>

      <Group gap="sm" align="center">
        <ThemeIcon size={38} radius="md" variant="light" color="indigo"><IconMapPin size={19} /></ThemeIcon>
        <Box><Text fw={800} fz="lg">Выберите следующий шаг</Text><Text size="sm" c="dimmed">Каждый сервис ведёт к конкретному действию, а не к пустой справочной странице.</Text></Box>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {SERVICES.map((service) => {
          const Icon = service.icon
          return <Paper key={service.href} component={Link} href={service.href} withBorder radius="lg" p="lg" className="service-card">
            <Stack gap="md" h="100%">
              <Group justify="space-between" align="flex-start"><ThemeIcon size={44} radius="md" variant="light" color={service.color}><Icon size={22} /></ThemeIcon><Badge size="xs" variant="light" color={service.color} radius="xl">{service.stage}</Badge></Group>
              <Box><Text fw={800} fz="lg">{service.title}</Text><Text size="sm" c="dimmed" mt={5} lh={1.45}>{service.description}</Text></Box>
              <Anchor component="span" size="sm" fw={750} c={`${service.color}.6`} mt="auto">Открыть сервис <IconArrowRight size={14} style={{ verticalAlign: "-2px" }} /></Anchor>
            </Stack>
          </Paper>
        })}
      </SimpleGrid>
    </Stack>
  </Box>
}
