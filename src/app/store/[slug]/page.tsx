import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge, Box, Card, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core"
import { IconBuildingStore, IconMapPin, IconTruckDelivery } from "@tabler/icons-react"
import StructuredData from "@/components/seo/StructuredData"
import PartOrderButton from "@/components/store/PartOrderButton"
import { prisma } from "@/lib/prisma"

type PageProps = { params: Promise<{ slug: string }> }

export const revalidate = 600

const ORIGIN_LABELS: Record<string, string> = {
  CN: "Китай", KR: "Корея", JP: "Япония", DE: "Европа", RU: "Россия",
}

const PART_TYPE_LABELS: Record<string, string> = {
  ENGINE: "Двигатель", TRANSMISSION: "Трансмиссия", SUSPENSION: "Подвеска", BRAKES: "Тормоза",
  ELECTRICAL: "Электрика", BODY: "Кузов", INTERIOR: "Салон", WHEELS: "Колёса", LIGHTING: "Оптика",
  COOLING: "Охлаждение", EXHAUST: "Выхлоп", STEERING: "Рулевое", ACCESSORIES: "Аксессуары",
  CONSUMABLES: "Расходники", OTHER: "Запчасти",
}

/** Витрина публикуется только после проверки: черновик виден лишь владельцу. */
async function getPublicStore(slug: string) {
  return prisma.partStore.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      id: true, name: true, slug: true, description: true, city: true,
      defaultLeadTimeDaysMin: true, defaultLeadTimeDaysMax: true, defaultOriginCountry: true,
      _count: { select: { parts: true } },
    },
  })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const store = await getPublicStore(slug)
  if (!store) return { title: "Магазин недоступен", robots: { index: false, follow: false } }

  const origin = store.defaultOriginCountry ? ORIGIN_LABELS[store.defaultOriginCountry] : null
  const title = `${store.name} — запчасти${origin ? ` из ${origin === "Европа" ? "Европы" : origin === "Китай" ? "Китая" : origin === "Корея" ? "Кореи" : origin === "Япония" ? "Японии" : "России"}` : ""} под заказ`
  const description = store.description?.slice(0, 155)
    || `${store.name}: ${store._count.parts} позиций в каталоге${store.city ? `, ${store.city}` : ""}. Сроки поставки и наличие указаны в карточке каждой запчасти.`

  return {
    title,
    description,
    alternates: { canonical: `/store/${store.slug}` },
    robots: { index: true, follow: true },
    openGraph: { type: "website", locale: "ru_RU", siteName: "LeWheel", title, description, url: `/store/${store.slug}` },
  }
}

export default async function StorefrontPage({ params }: PageProps) {
  const { slug } = await params
  const store = await getPublicStore(slug)
  if (!store) notFound()

  const [parts, categories] = await Promise.all([
    prisma.part.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true, name: true, price: true, oemNumber: true, brandName: true, partType: true,
        condition: true, supplyMode: true, leadTimeDaysMin: true, leadTimeDaysMax: true,
        originCountry: true, make: true, model: true,
      },
    }),
    prisma.part.groupBy({
      by: ["partType"],
      where: { storeId: store.id },
      _count: { _all: true },
      orderBy: { _count: { partType: "desc" } },
      take: 10,
    }),
  ])

  const origin = store.defaultOriginCountry ? ORIGIN_LABELS[store.defaultOriginCountry] : null

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="lg">
        <Card withBorder radius="lg" p="md">
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon variant="light" color="indigo" size={48} radius="md"><IconBuildingStore size={24} /></ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Title order={1} size="h3" ff="var(--font-display),sans-serif">{store.name}</Title>
              {store.description && <Text size="sm" c="dimmed" mt={4} maw={720}>{store.description}</Text>}
              <Group gap={6} mt={8} wrap="wrap">
                <Badge variant="light" color="indigo">{store._count.parts} позиций</Badge>
                {store.city && <Badge variant="outline" color="gray" leftSection={<IconMapPin size={11} />}>{store.city}</Badge>}
                {origin && <Badge variant="light" color="teal">Поставка из: {origin}</Badge>}
                {store.defaultLeadTimeDaysMin && (
                  <Badge variant="outline" color="gray" leftSection={<IconTruckDelivery size={11} />}>
                    {store.defaultLeadTimeDaysMin}–{store.defaultLeadTimeDaysMax || store.defaultLeadTimeDaysMin} дней
                  </Badge>
                )}
              </Group>
            </Box>
          </Group>
        </Card>

        {categories.length > 0 && (
          <Group gap={6} wrap="wrap">
            {categories.map((category) => (
              <Badge key={category.partType} size="lg" variant="light" color="gray">
                {PART_TYPE_LABELS[category.partType] || category.partType} · {category._count._all}
              </Badge>
            ))}
          </Group>
        )}

        {parts.length === 0 ? (
          <Card withBorder radius="lg" p="xl">
            <Text ta="center" c="dimmed">Каталог магазина пока пуст.</Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {parts.map((part) => (
              // Карточка не оборачивается в ссылку целиком: внутри есть
              // кнопка заказа, а вложенная в ссылку кнопка недопустима и
              // ломает клавиатурную навигацию.
              <Card key={part.id} withBorder radius="md" p="sm">
                <Text fw={700} size="sm" lineClamp={2} component={Link} href={`/listings/part/${part.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                  {part.name}
                </Text>
                <Group gap={4} mt={6} wrap="wrap">
                  {part.brandName && <Badge size="xs" variant="light" color="indigo">{part.brandName}</Badge>}
                  {part.oemNumber && <Badge size="xs" variant="outline" color="gray">{part.oemNumber}</Badge>}
                  <Badge size="xs" variant="light" color={part.condition === "NEW" ? "teal" : "orange"}>
                    {part.condition === "NEW" ? "Новая" : "Б/у"}
                  </Badge>
                </Group>
                {/* Срок и происхождение — то, ради чего покупатель сравнивает
                    магазины: цена без срока поставки не даёт принять решение. */}
                <Group gap={4} mt={6} wrap="wrap">
                  {part.supplyMode === "STOCK" ? (
                    <Badge size="xs" variant="light" color="teal">В наличии</Badge>
                  ) : (
                    <Badge size="xs" variant="light" color="orange">
                      {part.leadTimeDaysMin
                        ? `Под заказ ${part.leadTimeDaysMin}–${part.leadTimeDaysMax || part.leadTimeDaysMin} дн`
                        : "Под заказ"}
                    </Badge>
                  )}
                  {part.originCountry && ORIGIN_LABELS[part.originCountry] && (
                    <Badge size="xs" variant="outline" color="gray">{ORIGIN_LABELS[part.originCountry]}</Badge>
                  )}
                </Group>
                <Text fw={850} size="lg" mt={8}>{part.price.toLocaleString("ru-RU")} ₽</Text>
                <PartOrderButton
                  partId={part.id}
                  itemName={part.name}
                  priceRub={part.price}
                  supplyMode={part.supplyMode}
                  leadTimeDaysMin={part.leadTimeDaysMin}
                  leadTimeDaysMax={part.leadTimeDaysMax}
                  storeName={store.name}
                />
              </Card>
            ))}
          </SimpleGrid>
        )}

        <StructuredData
          data={{
            "@context": "https://schema.org",
            "@type": "Store",
            name: store.name,
            description: store.description || undefined,
            url: `https://lewheel.ru/store/${store.slug}`,
            address: store.city ? { "@type": "PostalAddress", addressLocality: store.city } : undefined,
            makesOffer: parts.slice(0, 10).map((part) => ({
              "@type": "Offer",
              name: part.name,
              price: part.price,
              priceCurrency: "RUB",
              availability: part.supplyMode === "STOCK"
                ? "https://schema.org/InStock"
                : "https://schema.org/PreOrder",
            })),
          }}
        />
      </Stack>
    </Container>
  )
}
