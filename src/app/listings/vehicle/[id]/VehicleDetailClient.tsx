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
  ActionIcon,
  Box,
  Divider,
  Rating,
  ThemeIcon,
  Breadcrumbs,
  Anchor,
  Skeleton,
} from "@mantine/core"
import { Carousel } from "@mantine/carousel"
import { useMediaQuery } from "@mantine/hooks"
import {
  IconHeart,
  IconPhone,
  IconMessageCircle2,
  IconShieldCheck,
  IconCheck,
  IconMapPin,
  IconCalendar,
  IconGauge,
  IconGasStation,
  IconManualGearbox,
  IconCar,
  IconBolt,
  IconPalette,
  IconEngine,
  IconUsers,
  IconRoute,
  IconChevronRight,
} from "@tabler/icons-react"
import Link from "next/link"
import { formatPrice, formatMileage, formatPriceShort, formatDate, parseImages, formatRelativeDate } from "@/lib/format"
import Photo360Viewer from "@/components/viewer/Photo360Viewer"
import CreditCalculator from "@/components/listings/CreditCalculator"

interface VehicleData {
  id: string
  make: string
  model: string
  year: number
  price: number
  mileage: number
  vin: string
  fuelType: string
  fuelTypeLabel: string
  transmission: string
  transmissionLabel: string
  bodyType: string | null
  bodyTypeLabel: string | null
  color: string | null
  doors: number | null
  engineVolume: number | null
  power: number | null
  driveType: string | null
  driveTypeLabel: string | null
  condition: string
  conditionLabel: string
  location: string
  lat: number | null
  lng: number | null
  description: string | null
  images: string | null
  createdAt: Date
  listingId?: string
  seller: {
    id: string
    name: string | null
    image: string | null
    memberSince: Date
    otherVehicles: { id: string; make: string; model: string; year: number; price: number }[]
  }
  reviews: { id: string; rating: number; comment: string | null; createdAt: Date; user: { name: string | null; image: string | null } }[]
  similar: { id: string; title: string; price: number; year: number; listingId?: string }[]
}

export default function VehicleDetailClient({ data }: { data: VehicleData }) {
  const [showPhone, setShowPhone] = useState(false)
  const [isFav, setIsFav] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const images = parseImages(data.images)
  const hasImages = images.length > 0

  const specs = [
    { icon: <IconCalendar size={20} />, label: "Год", value: String(data.year) },
    { icon: <IconGauge size={20} />, label: "Пробег", value: formatMileage(data.mileage) },
    { icon: <IconCar size={20} />, label: "Кузов", value: data.bodyTypeLabel || "—" },
    { icon: <IconGasStation size={20} />, label: "Двигатель", value: data.fuelTypeLabel },
    { icon: <IconManualGearbox size={20} />, label: "Коробка", value: data.transmissionLabel },
    { icon: <IconRoute size={20} />, label: "Привод", value: data.driveTypeLabel || "—" },
    { icon: <IconEngine size={20} />, label: "Объём", value: data.engineVolume ? `${data.engineVolume} л` : "—" },
    { icon: <IconBolt size={20} />, label: "Мощность", value: data.power ? `${data.power} л.с.` : "—" },
    { icon: <IconPalette size={20} />, label: "Цвет", value: data.color || "—" },
    { icon: <IconUsers size={20} />, label: "Дверей", value: data.doors ? String(data.doors) : "—" },
  ]

  return (
    <Container size="xl" py="lg">
      {/* Хлебные крошки */}
      <Breadcrumbs mb="md" separator={<IconChevronRight size={14} color="#a1a1aa" />}>
        <Anchor component={Link} href="/" size="sm" c="#71717a">Главная</Anchor>
        <Anchor component={Link} href="/search?type=vehicle" size="sm" c="#71717a">Автомобили</Anchor>
        <Text size="sm" c="#18181b">{data.make} {data.model}</Text>
      </Breadcrumbs>

      <Grid gutter="lg">
        {/* Левая колонка — галерея + характеристики */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {/* 360° просмотр */}
            <Photo360Viewer
              images={images}
              title={`${data.year} ${data.make} ${data.model} — 360° осмотр`}
            />

            {/* Галерея */}
            <Card p={0} radius="lg" withBorder style={{ overflow: "hidden" }}>
              {hasImages ? (
                <>
                  {/* Главное изображение */}
                  <Box style={{ position: "relative", background: "#f4f4f5", aspectRatio: "16/10" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={images[activeImage]}
                      alt={`${data.make} ${data.model}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <Badge
                      pos="absolute"
                      top={16}
                      left={16}
                      color="indigo"
                      variant="filled"
                      size="md"
                      style={{ backdropFilter: "blur(4px)" }}
                    >
                      {data.conditionLabel}
                    </Badge>
                  </Box>
                  {/* Thumbnails */}
                  {images.length > 1 && (
                    <Carousel
                      slideSize="120px"
                      slideGap="xs"
                      align="start"
                      dragFree
                      withControls={false}
                      p="xs"
                    >
                      {images.map((img, i) => (
                        <Carousel.Slide key={i}>
                          <Box
                            style={{
                              width: 110,
                              height: 80,
                              borderRadius: 8,
                              overflow: "hidden",
                              cursor: "pointer",
                              border: activeImage === i ? "2px solid #4f46e5" : "2px solid transparent",
                              transition: "border-color 150ms ease",
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
                <Box style={{ aspectRatio: "16/10", background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Stack align="center" gap="xs">
                    <IconCar size={48} color="#d4d4d8" />
                    <Text size="sm" c="#a1a1aa">Нет фото</Text>
                  </Stack>
                </Box>
              )}
            </Card>

            {/* Характеристики */}
            <Card withBorder radius="lg" p="lg">
              <Group justify="space-between" mb="md">
                <Title order={3} size="h4">Характеристики</Title>
                <Badge variant="light" color="gray" size="sm">VIN: {data.vin}</Badge>
              </Group>
              <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
                {specs.map((spec, i) => (
                  <Stack key={i} gap={6}>
                    <Group gap={6}>
                      <ThemeIcon variant="light" color="indigo" size={28} radius="md">
                        {spec.icon}
                      </ThemeIcon>
                      <Text size="xs" c="#a1a1aa">{spec.label}</Text>
                    </Group>
                    <Text size="sm" fw={500} c="#18181b" style={{ paddingLeft: 34 }}>
                      {spec.value}
                    </Text>
                  </Stack>
                ))}
              </SimpleGrid>
            </Card>

            {/* VIN-паспорт */}
            <Card withBorder radius="lg" p="lg" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 60%)", borderColor: "#bbf7d0" }}>
              <Group justify="space-between" mb="sm">
                <Group gap={8}>
                  <ThemeIcon variant="light" color="green" size={32} radius="md">
                    <IconShieldCheck size={18} />
                  </ThemeIcon>
                  <Title order={3} size="h4">VIN-паспорт</Title>
                </Group>
                <Badge variant="light" color="green" size="md">Проверено</Badge>
              </Group>
              <SimpleGrid cols={{ base: 2, md: 3 }} spacing="sm">
                <VinField label="VIN" value={data.vin} />
                <VinField label="Пробег" value={formatMileage(data.mileage)} status="ok" />
                <VinField label="Владельцев по ПТС" value="2" status="ok" />
                <VinField label="ДТП" value="Не найдено" status="ok" />
                <VinField label="В розыске" value="Нет" status="ok" />
                <VinField label="Залог / ограничения" value="Нет" status="ok" />
                <VinField label="Такси / аренда" value="Не использовалось" status="ok" />
                <VinField label="Утиль / тотал" value="Нет" status="ok" />
                <VinField label="Использование в лизинг" value="Нет" status="ok" />
              </SimpleGrid>
              <Group mt="md" gap="xs">
                <IconShieldCheck size={14} color="#16a34a" />
                <Text size="xs" c="#16a34a">Демо-данные. В продакшене — реальная проверка по базам ЕАЭС.</Text>
              </Group>
            </Card>

            {/* Безопасная сделка */}
            <Card withBorder radius="lg" p="lg" style={{ background: "linear-gradient(135deg, #eef2ff 0%, #ffffff 60%)", borderColor: "#c7d2fe" }}>
              <Group gap="md" align="flex-start">
                <ThemeIcon variant="light" color="indigo" size={44} radius="md">
                  <IconShieldCheck size={24} />
                </ThemeIcon>
                <Stack gap={6} style={{ flex: 1 }}>
                  <Title order={3} size="h4">Безопасная сделка</Title>
                  <Text size="sm" c="#52525b">
                    Деньги на защищённом счёте платформы до подписания договора и передачи ключей.
                    Страхование сделки включено.
                  </Text>
                  <Group gap={6} mt={4}>
                    <IconCheck size={14} color="#4f46e5" />
                    <Text size="xs" c="#4f46e5">Защита от мошенничества</Text>
                  </Group>
                  <Group gap={6}>
                    <IconCheck size={14} color="#4f46e5" />
                    <Text size="xs" c="#4f46e5">Проверка документов</Text>
                  </Group>
                  <Group gap={6}>
                    <IconCheck size={14} color="#4f46e5" />
                    <Text size="xs" c="#4f46e5">Возврат при отмене</Text>
                  </Group>
                </Stack>
                <Button variant="light" color="indigo" radius="md" size="md">Подробнее</Button>
              </Group>
            </Card>

            {/* Описание */}
            {data.description && (
              <Card withBorder radius="lg" p="lg">
                <Title order={3} size="h4" mb="sm">Описание</Title>
                <Text size="sm" c="#52525b" lh={1.6} style={{ whiteSpace: "pre-wrap" }}>
                  {data.description}
                </Text>
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
                        <Avatar src={review.user.image} radius="xl" size="sm" color="indigo">
                          {review.user.name?.[0]?.toUpperCase()}
                        </Avatar>
                        <Stack gap={2}>
                          <Text size="sm" fw={500}>{review.user.name || "Аноним"}</Text>
                          <Rating value={review.rating} size="xs" readOnly />
                        </Stack>
                        <Text size="xs" c="#a1a1aa" ml="auto">{formatRelativeDate(review.createdAt)}</Text>
                      </Group>
                      {review.comment && (
                        <Text size="sm" c="#52525b" pl={36}>{review.comment}</Text>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Card>
            )}

            {/* Похожие */}
            {data.similar.length > 0 && (
              <Box>
                <Title order={3} size="h4" mb="md">Похожие объявления</Title>
                <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
                  {data.similar.map((item) => (
                    <Card
                      key={item.id}
                      component={Link}
                      href={`/listings/vehicle/${item.id}`}
                      withBorder
                      radius="md"
                      p="sm"
                      style={{ transition: "all 180ms ease" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c7d2fe"; e.currentTarget.style.transform = "translateY(-2px)" }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e4e4e7"; e.currentTarget.style.transform = "none" }}
                    >
                      <Text size="sm" fw={500} className="line-clamp-1">{item.title}</Text>
                      <Text size="md" fw={700} c="indigo" mt={4}>{formatPriceShort(item.price)}</Text>
                    </Card>
                  ))}
                </SimpleGrid>
              </Box>
            )}
          </Stack>
        </Grid.Col>

        {/* Правая колонка — цена + продавец + действия */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Box style={{ position: "sticky", top: 80 }}>
            <Stack gap="md">
              {/* Цена и заголовок */}
              <Card withBorder radius="md" p="lg" style={{ borderColor: "#f4f4f5" }}>
                <Title
                  order={1}
                  size="h4"
                  mb={6}
                  ff="var(--font-display), sans-serif"
                  fw={700}
                  lh={1.2}
                  c="#18181b"
                >
                  {data.year} {data.make} {data.model}
                </Title>
                <Text
                  size="1.75rem"
                  fw={800}
                  c="#18181b"
                  ff="var(--font-display), sans-serif"
                  lh={1.1}
                  mb="xs"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {formatPrice(data.price)}
                </Text>
                <Group gap={6}>
                  <IconMapPin size={13} color="#a1a1aa" />
                  <Text size="xs" c="#71717a">{data.location}</Text>
                  <Text size="xs" c="#d4d4d8">·</Text>
                  <Text size="sm" c="#71717a">{formatRelativeDate(data.createdAt)}</Text>
                </Group>
              </Card>

              {/* Действия */}
              <Card withBorder radius="lg" p="lg">
                <Stack gap="sm">
                  <Button
                    size="lg"
                    radius="md"
                    leftSection={<IconPhone size={18} />}
                    variant={showPhone ? "light" : "filled"}
                    color="indigo"
                    onClick={() => setShowPhone(true)}
                  >
                    {showPhone ? "+7 (XXX) XXX-XX-XX" : "Показать телефон"}
                  </Button>
                  <Button
                    size="lg"
                    radius="md"
                    variant="outline"
                    color="indigo"
                    leftSection={<IconMessageCircle2 size={18} />}
                    component={Link}
                    href={`/messages/new?listingId=${data.listingId || data.id}`}
                  >
                    Написать продавцу
                  </Button>
                  <Button
                    size="lg"
                    radius="md"
                    variant="subtle"
                    color={isFav ? "red" : "gray"}
                    leftSection={<IconHeart size={18} fill={isFav ? "currentColor" : "none"} />}
                    onClick={() => setIsFav(!isFav)}
                  >
                    {isFav ? "В избранном" : "В избранное"}
                  </Button>
                </Stack>
              <CreditCalculator price={data.price} />
              </Card>

              {/* Продавец */}
              <Card withBorder radius="lg" p="lg">
                <Group gap="sm" mb="sm">
                  <Avatar src={data.seller.image} radius="xl" size="lg" color="indigo">
                    {data.seller.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Stack gap={2}>
                    <Text fw={600}>{data.seller.name || "Продавец"}</Text>
                    <Text size="xs" c="#a1a1aa">На Авторынке с {formatDate(data.seller.memberSince)}</Text>
                  </Stack>
                </Group>
                <Divider mb="sm" />
                <Group gap={6} mb="xs">
                  <IconShieldCheck size={16} color="#10b981" />
                  <Text size="sm" c="#52525b">Проверенный продавец</Text>
                </Group>
                {data.seller.otherVehicles.length > 0 && (
                  <Box mt="sm">
                    <Text size="xs" c="#71717a" mb={6}>Другие объявления ({data.seller.otherVehicles.length})</Text>
                    {data.seller.otherVehicles.slice(0, 3).map((v) => (
                      <Anchor
                        key={v.id}
                        component={Link}
                        href={`/listings/vehicle/${v.id}`}
                        size="xs"
                        c="indigo"
                        display="block"
                      >
                        {v.year} {v.make} {v.model} — {formatPriceShort(v.price)}
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

function VinField({ label, value, status }: { label: string; value: string; status?: "ok" | "warn" }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="#71717a">{label}</Text>
      <Group gap={4}>
        {status === "ok" && <IconCheck size={13} color="#16a34a" />}
        <Text size="sm" fw={500} c={status === "ok" ? "#16a34a" : "#18181b"}>{value}</Text>
      </Group>
    </Stack>
  )
}

