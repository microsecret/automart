import { Anchor, Box, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconBrain, IconChartBar, IconFileSearch, IconFuel, IconMapPin, IconShieldCheck } from "@tabler/icons-react"
import Link from "next/link"

const SERVICES = [
  { href: "/services/valuation", title: "Оценка стоимости", description: "Ориентир по рынку перед покупкой или продажей.", icon: IconChartBar, color: "indigo" },
  { href: "/services/history-check", title: "Проверка истории", description: "Заявка на проверку VIN и ключевых ограничений.", icon: IconFileSearch, color: "cyan" },
  { href: "/services/smart-matching", title: "Умный подбор", description: "Подбор транспорта по бюджету и параметрам.", icon: IconBrain, color: "violet" },
  { href: "/services/safe-deal", title: "Безопасная сделка", description: "Прозрачный сценарий оплаты и документов.", icon: IconShieldCheck, color: "teal" },
  { href: "/services/fuel-map", title: "Карта АЗС", description: "Точки заправок в крупных городах России.", icon: IconFuel, color: "orange" },
]

export default function ServicesPage() {
  return <Box className="service-page" p={{ base: "sm", md: "md" }}><Stack gap="lg"><Group gap="sm"><ThemeIcon size={44} radius="lg" variant="light" color="indigo"><IconMapPin size={22} /></ThemeIcon><Box><Text component="h1" fw={850} fz={28} ff="var(--font-display),sans-serif">Сервисы Авторынка</Text><Text size="sm" c="dimmed">Инструменты, которые помогают выбрать транспорт и провести сделку спокойнее.</Text></Box></Group><SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">{SERVICES.map((service) => { const Icon = service.icon; return <Paper key={service.href} component={Link} href={service.href} withBorder radius="lg" p="lg" className="service-card"><Stack gap="sm"><ThemeIcon size={42} radius="md" variant="light" color={service.color}><Icon size={21} /></ThemeIcon><Box><Text fw={800}>{service.title}</Text><Text size="sm" c="dimmed" mt={4}>{service.description}</Text></Box><Anchor component="span" size="sm" fw={700} c={`${service.color}.6`}>Открыть сервис →</Anchor></Stack></Paper> })}</SimpleGrid></Stack></Box>
}

