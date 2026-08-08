"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Box, Stack, Group, Text, ThemeIcon, SimpleGrid, Paper, Badge, SegmentedControl, Center, Loader, Image as MImage, Avatar, Button, Divider, ActionIcon } from "@mantine/core"
import { IconLayoutDashboard, IconTag, IconHeart, IconEye, IconStar, IconCar, IconPlus, IconSettings, IconChartBar, IconTrendingUp, IconClock, IconExternalLink } from "@tabler/icons-react"
import { useSession } from "next-auth/react"
import { formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import BrandIcon from "@/components/brands/BrandIcon"

const fetcher = (url) => fetch(url).then((r) => r.json())

export default function DashboardPage() {
  const { data: session } = useSession()
  const [tab, setTab] = useState("listings")
  const { data, isLoading } = useSWR("/api/dashboard/stats", fetcher)

  if (isLoading) return <Center py={80}><Loader size="sm" color="indigo" /></Center>
  if (!data) return <Center py={80}><Text c="#71717a">Не удалось загрузить данные</Text></Center>

  const stats = data.stats

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center" justify="space-between" wrap="nowrap">
          <Group gap="sm" align="center">
            <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconLayoutDashboard size={22} /></ThemeIcon>
            <Stack gap={0}>
              <Text component="h1" fw={800} fz={22} c="#18181b" ff="var(--font-display),sans-serif">Личный кабинет</Text>
              <Text size="xs" c="#71717a">{session?.user?.name || session?.user?.email}</Text>
            </Stack>
          </Group>
          <Button component={Link} href="/listings/create/vehicle" leftSection={<IconPlus size={16} />} color="indigo" radius="md" size="sm">Разместить</Button>
        </Group>

        {/* Карточки статистики */}
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
          {[
            { label: "Объявления", value: stats.totalListings, icon: <IconTag size={18} />, color: "#4f46e5", bg: "#eef2ff" },
            { label: "Просмотры", value: stats.totalViews, icon: <IconEye size={18} />, color: "#0891b2", bg: "#ecfeff" },
            { label: "Избранное", value: stats.favoritesCount, icon: <IconHeart size={18} />, color: "#e11d48", bg: "#fff1f2" },
            { label: "Отзывы", value: stats.reviewsCount, icon: <IconStar size={18} />, color: "#ea580c", bg: "#fff7ed" },
            { label: "В гараже", value: stats.garageCount, icon: <IconCar size={18} />, color: "#059669", bg: "#ecfdf5" },
            { label: "Рейтинг", value: stats.avgRating || "—", icon: <IconTrendingUp size={18} />, color: "#7c3aed", bg: "#f5f3ff" },
          ].map((s) => (
            <Paper key={s.label} radius="md" p="sm" withBorder style={{ borderColor: "#f4f4f5" }}>
              <Group gap="sm" align="center">
                <Box style={{ width: 36, height: 36, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                  {s.icon}
                </Box>
                <Stack gap={0}>
                  <Text size="xl" fw={800} c="#18181b" lh={1}>{s.value}</Text>
                  <Text size="xs" c="#71717a">{s.label}</Text>
                </Stack>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>

        {/* Табы */}
        <SegmentedControl
          value={tab}
          onChange={setTab}
          size="sm"
          radius="md"
          data={[
            { label: "Мои объявления", value: "listings" },
            { label: "Избранное", value: "favorites" },
            { label: "Гараж", value: "garage" },
            { label: "Профиль", value: "profile" },
          ]}
        />

        {/* Контент табов */}
        {tab === "listings" && (
          <Stack gap="xs">
            {data.listings.length === 0 ? (
              <Paper radius="md" p="xl" withBorder>
                <Center>
                  <Stack align="center" gap="sm">
                    <ThemeIcon variant="light" color="indigo" size={48} radius="md"><IconTag size={24} /></ThemeIcon>
                    <Text c="#71717a">У вас пока нет объявлений</Text>
                    <Button component={Link} href="/listings/create/vehicle" size="sm" color="indigo" leftSection={<IconPlus size={16} />}>Создать первое</Button>
                  </Stack>
                </Center>
              </Paper>
            ) : (
              data.listings.map((l) => {
                const isVehicle = !!l.vehicle
                const images = parseImages(isVehicle ? l.vehicle?.images : l.part?.images)
                const image = images[0] || "/placeholder.svg"
                const href = isVehicle ? `/listings/vehicle/${l.vehicle.id}` : `/listings/part/${l.part.id}`
                return (
                  <Paper key={l.id} radius="md" p="sm" withBorder style={{ borderColor: "#f4f4f5" }}>
                    <Group gap="md" align="center" wrap="nowrap">
                      <Link href={href} style={{ flexShrink: 0 }}>
                        <Box style={{ width: 100, height: 75, borderRadius: 8, overflow: "hidden", background: "#f4f4f5" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image} alt={l.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </Box>
                      </Link>
                      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Group gap="sm" align="center">
                          {isVehicle && l.vehicle && <BrandIcon brand={l.vehicle.make} size={28} />}
                          <Link href={href} style={{ textDecoration: "none" }}>
                            <Text fw={600} fz="sm" c="#18181b" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</Text>
                          </Link>
                          {l.isFeatured && <Badge size="xs" color="violet" variant="light">Премиум</Badge>}
                        </Group>
                        <Text fz="xs" c="#71717a">{isVehicle && l.vehicle ? `${formatMileage(l.vehicle.mileage)} · ${l.vehicle.location || "—"}` : l.part?.name}</Text>
                        <Group gap="md">
                          <Text fw={800} fz="md" c="#18181b" ff="var(--font-display),sans-serif">{formatPriceShort(l.price)}</Text>
                          <Group gap={4}>
                            <IconEye size={13} color="#a1a1aa" />
                            <Text fz="xs" c="#a1a1aa">{l.views} просмотров</Text>
                          </Group>
                          <Group gap={4}>
                            <IconClock size={13} color="#a1a1aa" />
                            <Text fz="xs" c="#a1a1aa">{formatRelativeDate(l.createdAt)}</Text>
                          </Group>
                        </Group>
                      </Stack>
                      <Group gap={4}>
                        <ActionIcon component={Link} href={href} variant="subtle" color="gray" size="sm"><IconExternalLink size={16} /></ActionIcon>
                        <ActionIcon component={Link} href={`/listings/${l.id}/promote`} variant="subtle" color="violet" size="sm"><IconTrendingUp size={16} /></ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                )
              })
            )}
          </Stack>
        )}

        {tab === "favorites" && (
          <Stack gap="xs">
            {data.favorites.length === 0 ? (
              <Paper radius="md" p="xl" withBorder>
                <Center>
                  <Stack align="center" gap="sm">
                    <ThemeIcon variant="light" color="red" size={48} radius="md"><IconHeart size={24} /></ThemeIcon>
                    <Text c="#71717a">В избранном пока пусто</Text>
                    <Button component={Link} href="/" size="sm" variant="light" color="indigo">Найти авто</Button>
                  </Stack>
                </Center>
              </Paper>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                {data.favorites.map((fav) => {
                  const v = fav.vehicle
                  if (!v) return null
                  const images = parseImages(v.images)
                  const image = images[0] || "/placeholder.svg"
                  return (
                    <Paper key={fav.id} radius="md" p={0} withBorder style={{ borderColor: "#f4f4f5", overflow: "hidden" }}>
                      <Link href={`/listings/vehicle/${v.id}`}>
                        <Box style={{ position: "relative", aspectRatio: "4/3", background: "#f4f4f5" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image} alt={v.make} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <Box pos="absolute" top={8} right={8}><BrandIcon brand={v.make} size={28} /></Box>
                        </Box>
                      </Link>
                      <Box p="sm">
                        <Text fw={800} fz="md" c="#18181b">{formatPriceShort(fav.price)}</Text>
                        <Text fz="xs" c="#52525b">{v.make} {v.model}, {v.year}</Text>
                        <Text fz="xs" c="#a1a1aa">{formatMileage(v.mileage)}</Text>
                      </Box>
                    </Paper>
                  )
                })}
              </SimpleGrid>
            )}
          </Stack>
        )}

        {tab === "garage" && (
          <Paper radius="md" p="xl" withBorder>
            <Center>
              <Stack align="center" gap="sm">
                <ThemeIcon variant="light" color="green" size={48} radius="md"><IconCar size={24} /></ThemeIcon>
                <Text fw={600} c="#18181b">Гараж</Text>
                <Text size="sm" c="#71717a" ta="center" maw={300}>В гараже {stats.garageCount} авто. Добавляйте машины для отслеживания обслуживания и истории.</Text>
                <Button component={Link} href="/dashboard" size="sm" variant="light" color="green">Добавить в гараж</Button>
              </Stack>
            </Center>
          </Paper>
        )}

        {tab === "profile" && (
          <Paper radius="md" p="lg" withBorder>
            <Stack gap="md">
              <Group gap="md" align="center">
                <Avatar src={session?.user?.image} size={64} radius="xl" color="indigo">{session?.user?.name?.[0]?.toUpperCase()}</Avatar>
                <Stack gap={0}>
                  <Text fw={700} fz="lg" c="#18181b">{session?.user?.name || "Без имени"}</Text>
                  <Text size="sm" c="#71717a">{session?.user?.email}</Text>
                  {stats.avgRating > 0 && (
                    <Group gap={4}>
                      <IconStar size={14} color="#f59e0b" fill="#f59e0b" />
                      <Text size="xs" c="#71717a">{stats.avgRating} рейтинг</Text>
                    </Group>
                  )}
                </Stack>
              </Group>
              <Divider />
              <SimpleGrid cols={2} spacing="sm">
                <Box><Text size="xs" c="#a1a1aa">На сайте с</Text><Text size="sm" fw={600} c="#18181b">2024</Text></Box>
                <Box><Text size="xs" c="#a1a1aa">Всего объявлений</Text><Text size="sm" fw={600} c="#18181b">{stats.totalListings}</Text></Box>
                <Box><Text size="xs" c="#a1a1aa">Просмотров всего</Text><Text size="sm" fw={600} c="#18181b">{stats.totalViews}</Text></Box>
                <Box><Text size="xs" c="#a1a1aa">Отзывов</Text><Text size="sm" fw={600} c="#18181b">{stats.reviewsCount}</Text></Box>
              </SimpleGrid>
              <Button variant="light" color="indigo" size="sm" leftSection={<IconSettings size={16} />} radius="md">Редактировать профиль</Button>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Box>
  )
}
