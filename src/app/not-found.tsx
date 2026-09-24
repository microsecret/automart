import Link from "next/link"
import { Container, Stack, Text, SimpleGrid, Paper, Group, ThemeIcon } from "@mantine/core"
import { IconCar, IconGavel, IconTool, IconGasStation } from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

/**
 * Страница «такой страницы нет».
 *
 * Раньше показывала только карточку с сообщением и кнопкой на главную. Из
 * неё было два выхода: назад или на главную, — а человек попал сюда по
 * устаревшей ссылке и, скорее всего, искал что-то определённое.
 *
 * Ряд разделов под сообщением стоит недорого (четыре ссылки) и отвечает
 * на вопрос «куда теперь»: каталог, аукционы, запчасти, заправки — это и
 * есть весь сайт в четырёх пунктах.
 */

const EXITS = [
  { href: "/", label: "Объявления", hint: "Машины от владельцев", Icon: IconCar, tone: "blue" },
  { href: "/auctions", label: "Аукционы", hint: "Лоты Японии и Кореи", Icon: IconGavel, tone: "grape" },
  { href: "/parts-finder", label: "Запчасти", hint: "Оригинал и аналоги", Icon: IconTool, tone: "teal" },
  { href: "/services/fuel-map", label: "Заправки", hint: "Цены на карте", Icon: IconGasStation, tone: "orange" },
]

export default function NotFoundPage() {
  return (
    <Container size="sm" py={{ base: 64, md: 112 }}>
      <Stack gap="xl">
        <AsyncErrorState
          title="Такой страницы нет"
          description="Адрес набран с ошибкой, страница переехала или объявление уже снято с публикации."
          backHref="/"
        />

        <Stack gap="sm">
          <Text size="xs" fw={800} tt="uppercase" c="var(--market-label)" style={{ letterSpacing: "var(--track-caps)" }}>
            Куда можно пойти
          </Text>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            {EXITS.map(({ href, label, hint, Icon, tone }) => (
              <Paper
                key={href}
                component={Link}
                href={href}
                p="sm"
                radius="md"
                withBorder
                className="market-linked-card"
                style={{ textDecoration: "none" }}
              >
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color={tone} size={36} radius="md">
                    <Icon size={18} />
                  </ThemeIcon>
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text fw={700} fz="var(--text-md)" c="var(--market-ink)">{label}</Text>
                    <Text fz="var(--text-xs)" c="var(--market-muted)">{hint}</Text>
                  </Stack>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>
      </Stack>
    </Container>
  )
}
