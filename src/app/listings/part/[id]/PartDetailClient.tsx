"use client"

import { useState } from "react"
import {
  Container,
  Grid,
  Stack,
  Group,
  Text,
  Title,
  Button,
  Badge,
  Card,
  SimpleGrid,
  Avatar,
  Box,
  Divider,
  Rating,
  ThemeIcon,
  Breadcrumbs,
  Anchor,
  TextInput,
} from "@mantine/core"
import { Carousel } from "@mantine/carousel"
import {
  IconHeart,
  IconPhone,
  IconMessageCircle2,
  IconShieldCheck,
  IconMapPin,
  IconTool,
  IconHash,
  IconAdjustments,
  IconCircleDot,
  IconCalendar,
  IconCar,
  IconChevronRight,
  IconCheck,
  IconGavel,
} from "@tabler/icons-react"
import Link from "next/link"
import { formatPrice, formatPriceShort, formatDate, parseImages, formatRelativeDate } from "@/lib/format"

const PART_TYPES_MAP: Record<string, string> = {
  ENGINE: "Двигатель", TRANSMISSION: "Трансмиссия", SUSPENSION: "Подвеска",
  BRAKES: "Тормоза", ELECTRICAL: "Электрика", BODY: "Кузов", INTERIOR: "Салон",
  WHEELS: "Колёса и диски", LIGHTING: "Оптика", ACCESSORIES: "Аксессуары", OTHER: "Другое",
}

const CONDITIONS_MAP: Record<string, string> = {
  NEW: "Новое", LIKE_NEW: "Как новое", EXCELLENT: "Отличное",
  GOOD: "Хорошее", FAIR: "Среднее", POOR: "Требует ремонта",
}

interface PartData {
  id: string
  name: string
  description: string | null
  price: number
  condition: string | null
  make: string
  model: string
  yearFrom: number | null
  yearTo: number | null
  partType: string
  subcategory: string | null
  oemNumber: string | null
  suspensionType: string | null
  brakeType: string | null
  compatibility: { id: string; make: string; model: string; generation: string | null; yearFrom: number | null; yearTo: number | null; engine: string | null }[]
  location: string
  images: string | null
  createdAt: Date
  saleFormat: string
  auctionStatus: string
  auctionEndsAt: Date | null
  auctionCurrentPrice: number | null
  auctionMinStep: number | null
  bids: { id: string; amount: number; createdAt: Date; user: { name: string | null } }[]
  listingId?: string
  seller: {
    id: string
    name: string | null
    image: string | null
    memberSince: Date
    otherParts: { id: string; name: string; price: number }[]
  }
  reviews: { id: string; rating: number; comment: string | null; createdAt: Date; user: { name: string | null; image: string | null } }[]
}

export default function PartDetailClient({ data }: { data: PartData }) {
  const [showPhone, setShowPhone] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [isFav, setIsFav] = useState(false)
  const [bidAmount, setBidAmount] = useState("")
  const [bidLoading, setBidLoading] = useState(false)
  const [bidMessage, setBidMessage] = useState<string | null>(null)
  const rawImages = parseImages(data.images)
  const images = rawImages.length > 0 ? rawImages : ["/placeholder.svg"]
  const hasImages = true
  const submitBid = async () => {
    setBidLoading(true)
    setBidMessage(null)
    try {
      const response = await fetch(`/api/parts/${data.id}/bid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: bidAmount }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Ставка не принята")
      setBidMessage(`Ставка ${(result.bid.amount as number).toLocaleString("ru-RU")} ₽ принята`)
      setBidAmount("")
    } catch (error: any) {
      setBidMessage(error.message || "Не удалось сделать ставку")
    } finally {
      setBidLoading(false)
    }
  }

  return (
    <Container size="xl" py="lg">
      <Breadcrumbs mb="md" separator={<IconChevronRight size={14} color="gray.4" />}>
        <Anchor component={Link} href="/" size="sm" c="gray.5">Главная</Anchor>
        <Anchor component={Link} href="/search?type=part" size="sm" c="gray.5">Запчасти</Anchor>
        <Text size="sm" c="dark.9" className="line-clamp-1">{data.name}</Text>
      </Breadcrumbs>

      <Grid gutter="lg">
        {/* Левая колонка */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {/* Галерея */}
            <Card p={0} radius="lg" withBorder style={{ overflow: "hidden" }}>
              {hasImages ? (
                <>
                  <Box style={{ position: "relative", background: "var(--mantine-color-gray-1)", aspectRatio: "16/10" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={images[activeImage]} alt={data.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {data.condition && (
                      <Badge pos="absolute" top={16} left={16} color="indigo" variant="filled" size="md" style={{ backdropFilter: "blur(4px)" }}>
                        {CONDITIONS_MAP[data.condition] || data.condition}
                      </Badge>
                    )}
                  </Box>
                  {images.length > 1 && (
                    <Carousel slideSize="120px" slideGap="xs" withControls={false} style={{ padding: "var(--mantine-spacing-xs)" }}>
                      {images.map((img, i) => (
                        <Carousel.Slide key={i}>
                          <Box
                            style={{
                              width: 110, height: 80, borderRadius: 8, overflow: "hidden", cursor: "pointer",
                              border: activeImage === i ? "2px solid #4f46e5" : "2px solid transparent",
                            }}
                            onClick={() => setActiveImage(i)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </Box>
                        </Carousel.Slide>
                      ))}
                    </Carousel>
                  )}
                </>
              ) : (
                <Box style={{ aspectRatio: "16/10", background: "var(--mantine-color-gray-1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Stack align="center" gap="xs">
                    <IconTool size={48} color="#d4d4d8" />
                    <Text size="sm" c="gray.4">Нет фото</Text>
                  </Stack>
                </Box>
              )}
            </Card>

            {/* Совместимость */}
            <Card withBorder radius="lg" p="lg">
              <Title order={3} size="h4" mb="md">Совместимость и характеристики</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <SpecRow icon={<IconTool size={18} />} label="Тип детали" value={PART_TYPES_MAP[data.partType] || data.partType} />
                <SpecRow icon={<IconCheck size={18} />} label="Состояние" value={data.condition ? CONDITIONS_MAP[data.condition] || data.condition : "—"} />
                {data.subcategory && <SpecRow icon={<IconTool size={18} />} label="Подкатегория" value={data.subcategory} />}
                {data.oemNumber && <SpecRow icon={<IconHash size={18} />} label="OEM номер" value={data.oemNumber} />}
                {data.make && data.model && <SpecRow icon={<IconCar size={18} />} label="Основной авто" value={`${data.make} ${data.model}${data.yearFrom ? ` ${data.yearFrom}-${data.yearTo || ""}` : ""}`} />}
                {data.suspensionType && <SpecRow icon={<IconAdjustments size={18} />} label="Тип подвески" value={data.suspensionType} />}
                {data.brakeType && <SpecRow icon={<IconCircleDot size={18} />} label="Тип тормозов" value={data.brakeType} />}
                <SpecRow icon={<IconCar size={18} />} label="Марка" value={data.make} />
                <SpecRow icon={<IconCar size={18} />} label="Модель" value={data.model} />
                <SpecRow icon={<IconCalendar size={18} />} label="Год от" value={data.yearFrom ? String(data.yearFrom) : "—"} />
                <SpecRow icon={<IconCalendar size={18} />} label="Год до" value={data.yearTo ? String(data.yearTo) : "—"} />
              </SimpleGrid>
            </Card>

            {/* Совместимость */}
            {data.compatibility && data.compatibility.length > 0 && (
              <Card withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Group gap="sm" align="center">
                    <ThemeIcon variant="light" color="green" size={32} radius="md"><IconCheck size={18} /></ThemeIcon>
                    <Stack gap={0}>
                      <Title order={3} size="h4">Совместимость</Title>
                      <Text size="xs" c="gray.5">Подходит на {data.compatibility.length} авто</Text>
                    </Stack>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
                    {data.compatibility.map((c) => (
                      <Group key={c.id} gap="sm" align="center"
                        style={{ background: "var(--mantine-color-gray-0)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--mantine-color-border)" }}>
                        <ThemeIcon variant="light" color="blue" size={32} radius="md"><IconCar size={18} /></ThemeIcon>
                        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" fw={600} c="dark.9">{c.make} {c.model}</Text>
                          <Text size="xs" c="gray.5">
                            {c.generation ? c.generation + " · " : ""}
                            {c.yearFrom || "?"}{c.yearTo ? `-${c.yearTo}` : "+"}
                            {c.engine ? " · " + c.engine : ""}
                          </Text>
                        </Stack>
                      </Group>
                    ))}
                  </SimpleGrid>
                </Stack>
              </Card>
            )}

            {/* Описание */}
            {data.description && (
              <Card withBorder radius="lg" p="lg">
                <Title order={3} size="h4" mb="sm">Описание</Title>
                <Text size="sm" c="gray.6" lh={1.6} style={{ whiteSpace: "pre-wrap" }}>{data.description}</Text>
              </Card>
            )}

            {/* Отзывы */}
            {data.reviews.length > 0 && (
              <Card withBorder radius="lg" p="lg">
                <Title order={3} size="h4" mb="md">Отзывы ({data.reviews.length})</Title>
                <Stack gap="md">
                  {data.reviews.map((review) => (
                    <Box key={review.id}>
                      <Group gap="sm" mb={6}>
                        <Avatar src={review.user.image} radius="xl" size="sm" color="indigo">{review.user.name?.[0]?.toUpperCase()}</Avatar>
                        <Stack gap={2}>
                          <Text size="sm" fw={500}>{review.user.name || "Аноним"}</Text>
                          <Rating value={review.rating} size="xs" readOnly />
                        </Stack>
                        <Text size="xs" c="gray.4" ml="auto">{formatRelativeDate(review.createdAt)}</Text>
                      </Group>
                      {review.comment && <Text size="sm" c="gray.6" pl={36}>{review.comment}</Text>}
                    </Box>
                  ))}
                </Stack>
              </Card>
            )}
          </Stack>
        </Grid.Col>

        {/* Правая колонка */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Box style={{ position: "sticky", top: 80 }}>
            <Stack gap="md">
              <Card withBorder radius="lg" p="lg" style={{ borderColor: "#c7d2fe", background: "linear-gradient(135deg, #ffffff 0%, #eef2ff 100%)" }}>
                <Title order={1} size="h4" mb={4}>{data.name}</Title>
                <Text size="1.75rem" fw={800} c={data.saleFormat === "AUCTION" ? "orange" : "indigo"} lh={1.1} mb="xs">{formatPrice(data.price)}</Text>
                <Group gap={6}>
                  <IconMapPin size={14} color="gray.5" />
                  <Text size="sm" c="gray.5">{data.location}</Text>
                  <Text size="sm" c="gray.4">·</Text>
                  <Text size="sm" c="gray.5">{formatRelativeDate(data.createdAt)}</Text>
                </Group>
                {data.saleFormat === "AUCTION" && (
                  <Badge mt="sm" color="orange" variant="light" leftSection={<IconGavel size={13} />}>Аукцион · {data.auctionStatus === "ACTIVE" ? "идёт" : "завершён"}</Badge>
                )}
              </Card>

              {data.saleFormat === "AUCTION" && (
                <Card withBorder radius="lg" p="lg" style={{ borderColor: "#fed7aa", background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)" }}>
                  <Group justify="space-between" mb="xs"><Text fw={700}>Сделать ставку</Text><IconGavel size={18} color="#f97316" /></Group>
                  <Text size="xs" c="gray.5">Минимум: {formatPrice((data.auctionCurrentPrice || data.price) + (data.auctionMinStep || 1))}</Text>
                  {data.auctionEndsAt && <Text size="xs" c="gray.5" mb="sm">Окончание: {new Date(data.auctionEndsAt).toLocaleString("ru-RU")}</Text>}
                  <TextInput placeholder="Сумма ставки, ₽" type="number" value={bidAmount} onChange={(event) => setBidAmount(event.currentTarget.value)} mb="sm" />
                  <Button fullWidth color="orange" loading={bidLoading} disabled={data.auctionStatus !== "ACTIVE" || !bidAmount} onClick={submitBid}>Подтвердить ставку</Button>
                  {bidMessage && <Text size="xs" c={bidMessage.includes("принята") ? "green" : "red"} mt="sm">{bidMessage}</Text>}
                  {data.bids.length > 0 && <Text size="xs" c="gray.5" mt="md">Последние ставки: {data.bids.slice(0, 3).map((bid) => `${bid.amount.toLocaleString("ru-RU")} ₽`).join(" · ")}</Text>}
                </Card>
              )}

              <Card withBorder radius="lg" p="lg">
                <Stack gap="sm">
                  <Button size="lg" radius="md" leftSection={<IconPhone size={18} />} variant={showPhone ? "light" : "filled"} color="indigo" onClick={() => setShowPhone(true)}>
                    {showPhone ? "+7 (XXX) XXX-XX-XX" : "Показать телефон"}
                  </Button>
                  <Button size="lg" radius="md" variant="outline" color="indigo" leftSection={<IconMessageCircle2 size={18} />} component={Link} href={`/messages/new?listingId=${data.listingId || data.id}`}>
                    Написать продавцу
                  </Button>
                  <Button size="lg" radius="md" variant="subtle" color={isFav ? "red" : "gray"} leftSection={<IconHeart size={18} fill={isFav ? "currentColor" : "none"} />} onClick={() => setIsFav(!isFav)}>
                    {isFav ? "В избранном" : "В избранное"}
                  </Button>
                </Stack>
              </Card>

              <Card withBorder radius="lg" p="lg">
                <Group gap="sm" mb="sm">
                  <Avatar src={data.seller.image} radius="xl" size="lg" color="indigo">{data.seller.name?.[0]?.toUpperCase()}</Avatar>
                  <Stack gap={2}>
                    <Text fw={600}>{data.seller.name || "Продавец"}</Text>
                    <Text size="xs" c="gray.4">На Авторынке с {formatDate(data.seller.memberSince)}</Text>
                  </Stack>
                </Group>
                <Divider mb="sm" />
                <Group gap={6}>
                  <IconShieldCheck size={16} color="#10b981" />
                  <Text size="sm" c="gray.6">Проверенный продавец</Text>
                </Group>
                {data.seller.otherParts.length > 0 && (
                  <Box mt="sm">
                    <Text size="xs" c="gray.5" mb={6}>Другие запчасти ({data.seller.otherParts.length})</Text>
                    {data.seller.otherParts.slice(0, 3).map((p) => (
                      <Anchor key={p.id} component={Link} href={`/listings/part/${p.id}`} size="xs" c="indigo" display="block">
                        {p.name} — {formatPriceShort(p.price)}
                      </Anchor>
                    ))}
                  </Box>
                )}
              </Card>
            </Stack>
          </Box>
        </Grid.Col>
      </Grid>
    </Container>
  )
}

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Group gap="sm" justify="space-between">
      <Group gap={8}>
        <ThemeIcon variant="light" color="indigo" size={30} radius="md">{icon}</ThemeIcon>
        <Text size="sm" c="gray.5">{label}</Text>
      </Group>
      <Text size="sm" fw={500} c="dark.9">{value}</Text>
    </Group>
  )
}
