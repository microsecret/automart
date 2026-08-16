"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
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
  ActionIcon,
  UnstyledButton,
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
  IconCar,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconGavel,
  IconPhoto,
  IconEdit,
  IconEye,
} from "@tabler/icons-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { notifications } from "@mantine/notifications"
import { formatPrice, formatPriceShort, formatDate, parseImages, formatRelativeDate } from "@/lib/format"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { useFavorites } from "@/hooks/useFavorites"
import ListingViewTracker from "@/components/analytics/ListingViewTracker"

const PART_TYPES_MAP: Record<string, string> = {
  ENGINE: "Двигатель", TRANSMISSION: "Трансмиссия", SUSPENSION: "Подвеска",
  BRAKES: "Тормоза", ELECTRICAL: "Электрика", BODY: "Кузов", INTERIOR: "Салон",
  WHEELS: "Колёса и диски", LIGHTING: "Оптика", ACCESSORIES: "Аксессуары", OTHER: "Другое",
}

const CONDITIONS_MAP: Record<string, string> = {
  NEW: "Новое", LIKE_NEW: "Как новое", EXCELLENT: "Отличное",
  GOOD: "Хорошее", FAIR: "Среднее", POOR: "Требует ремонта",
}

const AVAILABILITY_MAP: Record<string, string> = {
  IN_STOCK: "В наличии",
  ON_ORDER: "Под заказ",
  IN_TRANSIT: "В пути",
}

interface PartData {
  id: string
  name: string
  description: string | null
  price: number
  condition: string | null
  availability: string | null
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
  views: number
  seller: {
    id: string
    name: string | null
    image: string | null
    memberSince: Date
    otherParts: { id: string; name: string; price: number }[]
  }
  reviews: { id: string; rating: number; comment: string | null; createdAt: Date; user: { name: string | null; image: string | null } }[]
}

type BidResponse = { bid: { amount: number } }

export default function PartDetailClient({ data }: { data: PartData }) {
  const [viewCount, setViewCount] = useState(data.views)
  const { data: session } = useSession()
  const [phone, setPhone] = useState<string | null>(null)
  const [contactRevealing, setContactRevealing] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const [bidAmount, setBidAmount] = useState("")
  const [bidLoading, setBidLoading] = useState(false)
  const [bidMessage, setBidMessage] = useState<string | null>(null)
  const router = useRouter()
  const { favoriteIds, isAuthenticated, isPending, toggleFavorite } = useFavorites()
  const isSeller = session?.user?.id === data.seller.id
  const isFav = Boolean(data.listingId && favoriteIds.has(data.listingId))
  const toggleDetailFavorite = () => {
    if (!data.listingId) return
    if (!isAuthenticated) {
      notifications.show({
        title: "Войдите, чтобы сохранить",
        message: "Избранное синхронизируется между сайтом и Telegram после авторизации.",
        color: "indigo",
      })
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/listings/part/${data.id}`)}`)
      return
    }
    void toggleFavorite(data.listingId)
  }
  const rawImages = parseImages(data.images)
  const images = rawImages
  const hasImages = images.length > 0
  const selectImage = (index: number) => {
    setActiveImage(index)
    setImageFailed(false)
  }
  const revealPhone = async () => {
    if (!data.listingId || phone || contactRevealing) return
    if (!session) {
      notifications.show({
        title: "Войдите, чтобы увидеть телефон",
        message: "Так контакты продавцов защищены от автоматического сбора.",
        color: "indigo",
      })
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/listings/part/${data.id}`)}`)
      return
    }

    setContactRevealing(true)
    try {
      const payload = await fetchJson<{ phone: string }>(`/api/listings/${data.listingId}`, { method: "POST" })
      setPhone(payload.phone)
      notifications.show({ title: "Контакт продавца открыт", message: "Нажмите на номер, чтобы позвонить.", color: "green" })
    } catch (contactError) {
      notifications.show({
        title: "Не удалось открыть телефон",
        message: getApiClientErrorMessage(contactError, "Повторите попытку позже."),
        color: "red",
      })
    } finally {
      setContactRevealing(false)
    }
  }
  const moveImage = (direction: number) => selectImage((activeImage + direction + images.length) % images.length)
  const submitBid = async () => {
    setBidLoading(true)
    setBidMessage(null)
    try {
      const result = await fetchJson<BidResponse>(`/api/parts/${data.id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: bidAmount }),
      })
      setBidMessage(`Ставка ${(result.bid.amount as number).toLocaleString("ru-RU")} ₽ принята`)
      setBidAmount("")
      router.refresh()
    } catch (error) {
      setBidMessage(error instanceof Error ? error.message : "Не удалось сделать ставку")
    } finally {
      setBidLoading(false)
    }
  }

  return (
    <Container size="xl" py="lg">
      <ListingViewTracker listingId={data.listingId} onCount={setViewCount} />
      <Breadcrumbs mb="md" separator={<IconChevronRight size={14} color="var(--market-muted)" />}>
        <Anchor component={Link} href="/" size="sm" c="var(--market-muted)">Главная</Anchor>
        <Anchor component={Link} href="/search?type=part" size="sm" c="var(--market-muted)">Запчасти</Anchor>
        <Text size="sm" c="var(--market-ink)" className="line-clamp-1">{data.name}</Text>
      </Breadcrumbs>

      <Grid gutter="lg">
        {/* Левая колонка */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {/* Галерея */}
            <Card p={0} radius="lg" withBorder style={{ overflow: "hidden" }}>
              {hasImages ? (
                <>
                  <Box className="part-detail__gallery" style={{ position: "relative", aspectRatio: "4/3", maxHeight: 520 }}>
                    {imageFailed ? (
                      <Stack align="center" justify="center" gap="xs" h="100%" c="dimmed">
                        <ThemeIcon variant="light" color="gray" size={52} radius="xl"><IconPhoto size={25} /></ThemeIcon>
                        <Text size="sm">Фото недоступно</Text>
                      </Stack>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={images[activeImage]} alt={`${data.name} — фото ${activeImage + 1}`} onError={() => setImageFailed(true)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    )}
                    {data.condition && (
                      <Badge pos="absolute" top={14} left={14} color="indigo" variant="filled" size="sm" style={{ backdropFilter: "blur(4px)" }}>
                        {CONDITIONS_MAP[data.condition] || data.condition}
                      </Badge>
                    )}
                    {data.availability && <Badge pos="absolute" top={14} right={14} color={data.availability === "ON_ORDER" ? "orange" : "teal"} variant="light" size="sm" style={{ backdropFilter: "blur(4px)" }}>{AVAILABILITY_MAP[data.availability] || data.availability}</Badge>}
                    {images.length > 1 && <>
                      <ActionIcon aria-label="Предыдущее фото" variant="filled" color="dark" radius="xl" pos="absolute" left={14} top="50%" style={{ transform: "translateY(-50%)" }} onClick={() => moveImage(-1)}><IconChevronLeft size={18} /></ActionIcon>
                      <ActionIcon aria-label="Следующее фото" variant="filled" color="dark" radius="xl" pos="absolute" right={14} top="50%" style={{ transform: "translateY(-50%)" }} onClick={() => moveImage(1)}><IconChevronRight size={18} /></ActionIcon>
                      <Badge pos="absolute" bottom={14} right={14} variant="filled" color="dark" size="sm">{activeImage + 1} / {images.length}</Badge>
                    </>}
                  </Box>
                  {images.length > 1 && (
                    <Carousel slideSize="120px" slideGap="xs" withControls={false} style={{ padding: "var(--mantine-spacing-xs)" }}>
                      {images.map((img, i) => (
                        <Carousel.Slide key={i}>
                          <UnstyledButton
                            type="button"
                            aria-label={`Показать фото ${i + 1}`}
                            aria-current={activeImage === i ? "true" : undefined}
                            style={{
                              width: 110, height: 80, borderRadius: 8, overflow: "hidden", cursor: "pointer",
                              border: activeImage === i ? "2px solid var(--market-primary)" : "2px solid transparent",
                            }}
                            onClick={() => selectImage(i)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" onError={(event) => { event.currentTarget.style.opacity = "0" }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </UnstyledButton>
                        </Carousel.Slide>
                      ))}
                    </Carousel>
                  )}
                </>
              ) : (
                <Box className="part-detail__gallery part-detail__gallery--empty" style={{ aspectRatio: "16/10", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Stack align="center" gap="xs">
                    <ThemeIcon variant="light" color="gray" size={56} radius="xl"><IconPhoto size={28} /></ThemeIcon>
                    <Text size="sm" c="var(--market-muted)">Продавец ещё не добавил фото</Text>
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
                {data.availability && <SpecRow icon={<IconCheck size={18} />} label="Наличие" value={AVAILABILITY_MAP[data.availability] || data.availability} />}
                {data.subcategory && <SpecRow icon={<IconTool size={18} />} label="Подкатегория" value={data.subcategory} />}
                {data.oemNumber && <SpecRow icon={<IconHash size={18} />} label="OEM номер" value={data.oemNumber} />}
                {data.make && data.model && data.make !== "Universal" && <SpecRow icon={<IconCar size={18} />} label="Основной авто" value={`${data.make} ${data.model}${data.yearFrom ? ` ${data.yearFrom}-${data.yearTo || ""}` : ""}`} />}
                {data.suspensionType && <SpecRow icon={<IconAdjustments size={18} />} label="Тип подвески" value={data.suspensionType} />}
                {data.brakeType && <SpecRow icon={<IconCircleDot size={18} />} label="Тип тормозов" value={data.brakeType} />}
                {(!data.make || data.make === "Universal") && <SpecRow icon={<IconCar size={18} />} label="Совместимость" value="Универсальная" />}
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
                      <Text size="xs" c="var(--market-muted)">Подходит на {data.compatibility.length} авто</Text>
                    </Stack>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
                    {data.compatibility.map((c) => (
                      <Group key={c.id} gap="sm" align="center"
                        className="part-detail__compatibility-item"
                        style={{ borderRadius: 10, padding: "10px 12px" }}>
                        <ThemeIcon variant="light" color="blue" size={32} radius="md"><IconCar size={18} /></ThemeIcon>
                        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" fw={600} c="var(--market-ink)">{c.make} {c.model}</Text>
                          <Text size="xs" c="var(--market-muted)">
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
                <Text size="sm" c="var(--market-muted)" lh={1.6} style={{ whiteSpace: "pre-wrap" }}>{data.description}</Text>
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
                        <Text size="xs" c="var(--market-muted)" ml="auto">{formatRelativeDate(review.createdAt)}</Text>
                      </Group>
                      {review.comment && <Text size="sm" c="var(--market-muted)" pl={36}>{review.comment}</Text>}
                    </Box>
                  ))}
                </Stack>
              </Card>
            )}
          </Stack>
        </Grid.Col>

        {/* Правая колонка */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Box className="part-detail__sticky-aside">
            <Stack gap="md">
              <Card withBorder radius="lg" p="lg" className="part-detail__price-card">
                <Title order={1} size="h4" mb={4}>{data.name}</Title>
                <Text size="1.75rem" fw={800} c={data.saleFormat === "AUCTION" ? "orange" : "indigo"} lh={1.1} mb="xs">{formatPrice(data.price)}</Text>
                <Group gap={6}>
                  <IconMapPin size={14} color="var(--market-muted)" />
                  <Text size="sm" c="var(--market-muted)">{data.location}</Text>
                  <Text size="sm" c="var(--market-muted)">·</Text>
                  <Text size="sm" c="var(--market-muted)">{formatRelativeDate(data.createdAt)}</Text>
                  <Text size="sm" c="var(--market-muted)">·</Text>
                  <Group gap={3}><IconEye size={13} color="var(--market-muted)" /><Text size="sm" c="var(--market-muted)">{viewCount} просмотров</Text></Group>
                </Group>
                {data.saleFormat === "AUCTION" && (
                  <Badge mt="sm" color="orange" variant="light" leftSection={<IconGavel size={13} />}>Аукцион · {data.auctionStatus === "ACTIVE" ? "идёт" : "завершён"}</Badge>
                )}
              </Card>

              {data.saleFormat === "AUCTION" && (
                <Card withBorder radius="lg" p="lg" className="part-detail__bid-card">
                  <Group justify="space-between" mb="xs"><Text fw={700}>Сделать ставку</Text><IconGavel size={18} color="#f97316" /></Group>
                  <Text size="xs" c="var(--market-muted)">Минимум: {formatPrice((data.auctionCurrentPrice || data.price) + (data.auctionMinStep || 1))}</Text>
                  {data.auctionEndsAt && <Text size="xs" c="var(--market-muted)" mb="sm">Окончание: {new Date(data.auctionEndsAt).toLocaleString("ru-RU")}</Text>}
                  {isSeller ? (
                    <Text size="sm" c="var(--market-muted)">Это ваш лот. Ставки владельца недоступны.</Text>
                  ) : (
                    <>
                      <TextInput placeholder="Сумма ставки, ₽" type="number" value={bidAmount} onChange={(event) => setBidAmount(event.currentTarget.value)} mb="sm" />
                      <Button fullWidth color="orange" loading={bidLoading} disabled={data.auctionStatus !== "ACTIVE" || !bidAmount} onClick={submitBid}>Подтвердить ставку</Button>
                    </>
                  )}
                  {bidMessage && <Text size="xs" c={bidMessage.includes("принята") ? "green" : "red"} mt="sm">{bidMessage}</Text>}
                  {data.bids.length > 0 && <Text size="xs" c="var(--market-muted)" mt="md">Последние ставки: {data.bids.slice(0, 3).map((bid) => `${bid.amount.toLocaleString("ru-RU")} ₽`).join(" · ")}</Text>}
                </Card>
              )}

              <Card withBorder radius="lg" p="lg">
                <Stack gap="sm">
                  {phone ? (
                    <Button component="a" href={`tel:${phone}`} size="lg" radius="md" leftSection={<IconPhone size={18} />} variant="light" color="indigo">
                      {phone}
                    </Button>
                  ) : (
                    <Button size="lg" radius="md" leftSection={<IconPhone size={18} />} color="indigo" onClick={() => void revealPhone()} loading={contactRevealing} disabled={!data.listingId}>
                      Показать телефон
                    </Button>
                  )}
                  {isSeller && data.listingId && <Button size="lg" radius="md" variant="light" color="indigo" leftSection={<IconEdit size={18} />} component={Link} href={`/listings/${data.listingId}/edit`}>Редактировать объявление</Button>}
                  <Button size="lg" radius="md" variant="outline" color="indigo" leftSection={<IconMessageCircle2 size={18} />} component={Link} href={`/messages/new?listingId=${data.listingId || data.id}&recipientId=${data.seller.id}`}>
                    Написать продавцу
                  </Button>
                  <Button size="lg" radius="md" variant={isFav ? "light" : "default"} color={isFav ? "red" : "gray"} leftSection={<IconHeart size={18} fill={isFav ? "currentColor" : "none"} />} onClick={toggleDetailFavorite} loading={data.listingId ? isPending(data.listingId) : false} disabled={!data.listingId}>
                    {isFav ? "В избранном" : "В избранное"}
                  </Button>
                </Stack>
              </Card>

              <Card withBorder radius="lg" p="lg">
                <Group gap="sm" mb="sm">
                  <Avatar src={data.seller.image} radius="xl" size="lg" color="indigo">{data.seller.name?.[0]?.toUpperCase()}</Avatar>
                  <Stack gap={2}>
                    <Text fw={600}>{data.seller.name || "Продавец"}</Text>
                    <Text size="xs" c="var(--market-muted)">На Авторынке с {formatDate(data.seller.memberSince)}</Text>
                  </Stack>
                </Group>
                <Divider mb="sm" />
                <Group gap={6}>
                  <IconShieldCheck size={16} color="#10b981" />
                  <Text size="sm" c="var(--market-muted)">Проверенный продавец</Text>
                </Group>
                {data.seller.otherParts.length > 0 && (
                  <Box mt="sm">
                    <Text size="xs" c="var(--market-muted)" mb={6}>Другие запчасти ({data.seller.otherParts.length})</Text>
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
        <Text size="sm" c="var(--market-muted)">{label}</Text>
      </Group>
      <Text size="sm" fw={500} c="var(--market-ink)">{value}</Text>
    </Group>
  )
}
