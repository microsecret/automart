import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Anchor, Badge, Box, Button, Card, Container, Divider, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core"
import { IconArrowRight, IconCalculator, IconGavel, IconShieldCheck } from "@tabler/icons-react"
import StructuredData from "@/components/seo/StructuredData"
import { buildAuctionLandingStats, findAuctionLanding, listAuctionLandings } from "@/lib/auction-landing"
import { formatPriceShort } from "@/lib/format"

type PageProps = { params: Promise<{ country: string; make: string }> }

// Каталог обновляется парсером каждые 20 минут. Страницы пересобираются раз в
// час: свежие цифры без перегенерации всего раздела на каждый импорт.
export const revalidate = 3600

/**
 * Маршруты берутся из фактического каталога, поэтому новое направление
 * появляется само, как только парсер привёз по нему достаточно лотов.
 */
export async function generateStaticParams() {
  const landings = await listAuctionLandings()
  return landings.map((landing) => ({ country: landing.countrySlug, make: landing.makeSlug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country, make } = await params
  const landing = await findAuctionLanding(country, make)
  if (!landing) return { title: "Направление недоступно", robots: { index: false, follow: false } }

  const stats = await buildAuctionLandingStats(landing.countryCode, landing.make)
  const priceHint = stats.minPrice ? ` от ${formatPriceShort(stats.minPrice)}` : ""
  const title = `${landing.makeLabel} из ${landing.countryGenitive} под заказ — ${landing.total} авто${priceHint}`
  const description = `Актуальные лоты ${landing.makeLabel} с аукционов ${landing.countryGenitive}: ${landing.total} автомобилей${priceHint} за лот с комиссией. Доставка, пошлина и утильсбор считаются в карточке машины по курсу ЦБ.`
  const canonical = `/auctions/iz/${landing.countrySlug}/${landing.makeSlug}`

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: "website", locale: "ru_RU", siteName: "LeWheel", title, description, url: canonical },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function AuctionLandingPage({ params }: PageProps) {
  const { country, make } = await params
  const landing = await findAuctionLanding(country, make)
  if (!landing) notFound()

  const stats = await buildAuctionLandingStats(landing.countryCode, landing.make)
  const catalogHref = `/auctions?country=${landing.countryCode}&make=${encodeURIComponent(landing.make)}`
  const related = (await listAuctionLandings())
    .filter((item) => item.countrySlug === landing.countrySlug && item.makeSlug !== landing.makeSlug)
    .slice(0, 8)

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="lg">
        <Box>
          <Group gap={6} mb="xs">
            <Anchor component={Link} href="/auctions" size="xs" c="dimmed">Аукционы мира</Anchor>
            <Text size="xs" c="dimmed">/</Text>
            <Text size="xs" c="dimmed">{landing.countryNominative}</Text>
          </Group>
          <Title order={1} size="h2" ff="var(--font-display),sans-serif">
            {landing.makeLabel} из {landing.countryGenitive} под заказ
          </Title>
          <Text c="dimmed" mt={6} maw={720}>
            В каталоге {landing.total} автомобилей {landing.makeLabel} с проверенных площадок {landing.countryGenitive}.
            Цена указана под ключ: стоимость лота пересчитана по курсу ЦБ, доставка и таможенное оформление считаются
            по вашему городу.
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed">Автомобилей в наличии</Text>
            <Text fw={850} size="xl" mt={4}>{landing.total}</Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed">Лот с комиссией от</Text>
            <Text fw={850} size="xl" mt={4}>{stats.minPrice ? formatPriceShort(stats.minPrice) : "—"}</Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed">Медианная цена</Text>
            <Text fw={850} size="xl" mt={4}>{stats.medianPrice ? formatPriceShort(stats.medianPrice) : "—"}</Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed">Средний год выпуска</Text>
            <Text fw={850} size="xl" mt={4}>{stats.averageYear ?? "—"}</Text>
          </Card>
        </SimpleGrid>

        <Group gap="sm" wrap="wrap">
          <Button component={Link} href={catalogHref} size="md" color="indigo" rightSection={<IconArrowRight size={16} />}>
            Смотреть {landing.total} лотов
          </Button>
          <Button component={Link} href="/services/valuation" size="md" variant="light" color="indigo" leftSection={<IconCalculator size={16} />}>
            Рассчитать стоимость под ключ
          </Button>
        </Group>

        {stats.models.length > 0 && (
          <Card withBorder radius="md" p="md">
            <Title order={2} size="h5" mb="sm">Какие модели {landing.makeLabel} есть в наличии</Title>
            <Group gap={6} wrap="wrap">
              {stats.models.map((item) => (
                <Badge key={item.model} size="lg" variant="light" color="indigo">
                  {item.model} · {item.count}
                </Badge>
              ))}
            </Group>
            {stats.bodyTypes.length > 0 && (
              <Text size="sm" c="dimmed" mt="sm">
                По типу кузова: {stats.bodyTypes.map((item) => `${item.label} — ${item.count}`).join(", ")}.
              </Text>
            )}
          </Card>
        )}

        <Card withBorder radius="md" p="md">
          <Title order={2} size="h5" mb="sm">Как проходит покупка {landing.makeLabel} из {landing.countryGenitive}</Title>
          <Stack gap="sm">
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon variant="light" color="indigo" radius="md" size={32}><IconGavel size={17} /></ThemeIcon>
              <Box>
                <Text fw={700} size="sm">Выбор лота и проверка</Text>
                <Text size="sm" c="dimmed">
                  Карточка содержит данные площадки: год, пробег, комплектацию и отчёт осмотра. Лоты с противоречивыми
                  характеристиками скрываются автоматической проверкой качества и не попадают в выдачу.
                </Text>
              </Box>
            </Group>
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon variant="light" color="teal" radius="md" size={32}><IconCalculator size={17} /></ThemeIcon>
              <Box>
                <Text fw={700} size="sm">Расчёт под ключ</Text>
                <Text size="sm" c="dimmed">
                  Стоимость лота пересчитывается по курсу ЦБ. Доставка, таможенная пошлина и утилизационный сбор
                  считаются отдельно по вашему городу и подтверждаются документами.
                </Text>
              </Box>
            </Group>
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon variant="light" color="violet" radius="md" size={32}><IconShieldCheck size={17} /></ThemeIcon>
              <Box>
                <Text fw={700} size="sm">Сопровождение сделки</Text>
                <Text size="sm" c="dimmed">
                  Выкуп, логистику и таможенное оформление ведёт проверенный партнёр. Этапы, документы и статусы
                  доступны в личном кабинете.
                </Text>
              </Box>
            </Group>
          </Stack>
        </Card>

        {related.length > 0 && (
          <Box>
            <Divider mb="sm" />
            <Text fw={750} size="sm" mb="xs">Другие марки из {landing.countryGenitive}</Text>
            <Group gap={6} wrap="wrap">
              {related.map((item) => (
                <Button
                  key={item.makeSlug}
                  component={Link}
                  href={`/auctions/iz/${item.countrySlug}/${item.makeSlug}`}
                  size="compact-sm"
                  variant="default"
                >
                  {item.makeLabel} · {item.total}
                </Button>
              ))}
            </Group>
          </Box>
        )}

        <StructuredData
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${landing.makeLabel} из ${landing.countryGenitive} под заказ`,
            description: `Аукционные лоты ${landing.makeLabel} из ${landing.countryGenitive} с расчётом стоимости под ключ.`,
            url: `https://lewheel.ru/auctions/iz/${landing.countrySlug}/${landing.makeSlug}`,
            about: { "@type": "Brand", name: landing.makeLabel },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: landing.total,
              itemListElement: stats.models.slice(0, 5).map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: `${landing.makeLabel} ${item.model}`,
              })),
            },
            ...(stats.minPrice && stats.maxPrice ? {
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "RUB",
                lowPrice: stats.minPrice,
                highPrice: stats.maxPrice,
                offerCount: landing.total,
              },
            } : {}),
          }}
        />
      </Stack>
    </Container>
  )
}
