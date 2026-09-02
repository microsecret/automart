import { Box, Stack, Title, Text, Card, Group, ThemeIcon, SimpleGrid, Divider, Badge } from "@mantine/core"
import { IconCar, IconShieldCheck, IconUsers, IconNews, IconSparkles, IconHeart, IconCheck } from "@tabler/icons-react"
import { COUNTRIES } from "@/lib/geo"

const FEATURES = [
  { icon: <IconCar size={20} />, title: "6 видов транспорта", desc: "Легковые, мото, грузовики, спецтехника, водный и воздушный транспорт" },
  { icon: <IconShieldCheck size={20} />, title: "Сопровождение сделки", desc: "Проверка продавца, документов и статусов покупки" },
  { icon: <IconSparkles size={20} />, title: "Умный подбор", desc: "ИИ-калькулятор запчастей и подбор авто под бюджет" },
  { icon: <IconNews size={20} />, title: "Авто-новости", desc: "82+ актуальных публикаций с комментариями" },
  { icon: <IconUsers size={20} />, title: "Сообщество", desc: "Отзывы, рейтинги продавцов, комментарии" },
  { icon: <IconHeart size={20} />, title: "Избранное и сравнение", desc: "Сравнение до 10 авто side-by-side" },
]

const STATS = [
  { label: "Объявлений", value: "334+" },
  { label: "Брендов", value: "188" },
  { label: "Категорий транспорта", value: "6" },
  { label: "Новостей", value: "82" },
  { label: "Городов ЕАЭС", value: "150+" },
  { label: "Стран", value: "6" },
]

export default function AboutPage() {
  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 800, margin: "0 auto" }}>
      <Stack gap="md">
        <Stack gap="xs" align="center" ta="center" py="md">
          <Badge variant="light" color="indigo" size="md">О проекте</Badge>
          <Title order={1} ff="var(--font-display),sans-serif" fw={800} fz={{ base: 26, md: 32 }} c="var(--market-ink)" style={{ letterSpacing: "var(--track-title)" }}>
            LeWheel — маркетплейс транспорта
          </Title>
          <Text size="sm" c="gray.5" maw={500} lh={1.6}>
            Полноценная экосистема для покупки и продажи автомобилей, мото, спецтехники,
            водного и воздушного транспорта в странах ЕАЭС. С проверкой истории, безопасной сделкой
            и умным подбором.
          </Text>
        </Stack>

        {/* Статистика */}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="xs">
          {STATS.map((s) => (
            <Card key={s.label} withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Stack gap={0} align="center" ta="center">
                <Text size="xl" fw={800} c="var(--market-primary)" ff="var(--font-display),sans-serif">{s.value}</Text>
                <Text size="xs" c="gray.5">{s.label}</Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Divider color="#f4f4f5" />

        {/* Возможности */}
        <Stack gap="xs">
          <Title order={2} size="h4" ff="var(--font-display),sans-serif" c="var(--market-ink)">Возможности</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {FEATURES.map((f) => (
              <Card key={f.title} withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
                <Group gap="sm" align="flex-start">
                  <ThemeIcon variant="light" color="indigo" size={36} radius="md">{f.icon}</ThemeIcon>
                  <Stack gap={2}>
                    <Text size="sm" fw={600} c="var(--market-ink)">{f.title}</Text>
                    <Text size="xs" c="gray.5" lh={1.4}>{f.desc}</Text>
                  </Stack>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>

        <Divider color="#f4f4f5" />

        {/* Страны ЕАЭС */}
        <Stack gap="xs">
          <Title order={2} size="h4" ff="var(--font-display),sans-serif" c="var(--market-ink)">География</Title>
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
            {COUNTRIES.map((c) => (
              <Card key={c.code} withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
                <Group gap="sm">
                  <Text size="xl">{c.flag}</Text>
                  <Stack gap={0}>
                    <Text size="sm" fw={600} c="var(--market-ink)">{c.name}</Text>
                    <Text size="xs" c="gray.4">{c.cities.length} городов</Text>
                  </Stack>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>

        <Divider color="#f4f4f5" />

        {/* Принципы */}
        <Stack gap="xs">
          <Title order={2} size="h4" ff="var(--font-display),sans-serif" c="var(--market-ink)">Наши принципы</Title>
          <Stack gap="xs">
            {[
              "Доверие превыше всего — верификация продавцов и VIN-паспорт",
              "Минимум трения — размещение за 2 минуты, поиск за 2 клика",
              "Прозрачность — никаких скрытых платежей, честные цены",
              "Безопасность — проверка продавца, документов и этапов покупки",
              "Экосистема — от поиска до владения в одном месте",
            ].map((p, i) => (
              <Group key={i} gap="sm">
                <ThemeIcon variant="light" color="green" size={28} radius="md"><IconCheck size={14} /></ThemeIcon>
                <Text size="sm" c="var(--market-ink)">{p}</Text>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Box>
  )
}
