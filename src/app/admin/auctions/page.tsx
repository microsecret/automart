"use client"
export const dynamic = "force-dynamic"
import useSWR from "swr"
import { Box, Stack, Group, Text, Paper, Badge, Center, Loader, ThemeIcon, Select, SimpleGrid } from "@mantine/core"
import { IconDatabase, IconGavel, IconPhone, IconMail, IconMapPin, IconClock } from "@tabler/icons-react"
import { formatRelativeDate } from "@/lib/format"
import { useState } from "react"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { isSafeMediaUrl } from "@/lib/media-url"

const fetcher = fetchJson

type AuctionInquiry = {
  id: string
  status: string
  phone: string
  name: string
  email?: string | null
  city?: string | null
  comment?: string | null
  createdAt: string
  auctionListing?: {
    imageUrl?: string | null
    make: string
    model: string
    year: number
    source: string
    finalPrice?: number | null
  } | null
}

type AuctionInquiryResponse = { inquiries: AuctionInquiry[] }
type AuctionStatsResponse = {
  total: number
  visibleAuctions?: number
  totalAuctions?: number
  recent?: number
  lastAuctionSync?: string | null
  byStatus?: Partial<Record<(typeof STATUSES)[number]["value"], number>>
}

const STATUSES = [
  { value: "NEW", label: "Новые", color: "red" },
  { value: "CONTACTED", label: "Связались", color: "orange" },
  { value: "IN_PROGRESS", label: "В работе", color: "blue" },
  { value: "CLOSED", label: "Закрыто", color: "gray" },
  { value: "SOLD", label: "Продано", color: "green" },
]

export default function AdminAuctionsPage() {
  const [status, setStatus] = useState("NEW")
  const { data, error, isLoading, mutate } = useSWR<AuctionInquiryResponse>(`/api/admin/auctions/inquiries${status ? `?status=${status}` : ""}`, fetcher)
  const { data: stats } = useSWR<AuctionStatsResponse>("/api/admin/auctions/stats", fetcher)
  const inquiries = data?.inquiries || []

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="orange" size={44} radius="md"><IconGavel size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Заявки с аукционов</Text>
            <Text size="xs" c="gray.5">{inquiries.length} заявок</Text>
          </Stack>
        </Group>

        {/* Статистика */}
        {stats && (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 7 }} spacing="sm">
            {[
              { label: "Всего заявок", value: stats.total, color: "#4f46e5", bg: "#eef2ff" },
              { label: "Лотов в каталоге", value: stats.visibleAuctions ?? stats.totalAuctions ?? 0, color: "#c2410c", bg: "#fff7ed" },
              { label: "Новые", value: stats.byStatus?.NEW || 0, color: "#e11d48", bg: "#fff1f2" },
              { label: "Связались", value: stats.byStatus?.CONTACTED || 0, color: "#ea580c", bg: "#fff7ed" },
              { label: "В работе", value: stats.byStatus?.IN_PROGRESS || 0, color: "#2563eb", bg: "#eff6ff" },
              { label: "Продано", value: stats.byStatus?.SOLD || 0, color: "#059669", bg: "#ecfdf5" },
              { label: "За неделю", value: stats.recent || 0, color: "#7c3aed", bg: "#f5f3ff" },
            ].map((card) => (
              <Paper key={card.label} radius="md" p="sm" withBorder>
                <Group gap="sm" align="center">
                  <Box style={{ width: 36, height: 36, borderRadius: 8, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Text fw={800} fz="lg" c={card.color} lh={1}>{card.value}</Text>
                  </Box>
                  <Text size="xs" c="gray.5">{card.label}</Text>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        )}

        {stats && (
          <Paper radius="md" p="sm" withBorder bg={stats.visibleAuctions ? undefined : "orange.0"}>
            <Group gap="xs" wrap="nowrap">
              <ThemeIcon variant="light" color={stats.visibleAuctions ? "orange" : "red"} size="sm"><IconDatabase size={14} /></ThemeIcon>
              <Text size="xs" c="gray.6">
                {stats.lastAuctionSync ? `Последняя проверка источников: ${formatRelativeDate(stats.lastAuctionSync)}.` : "Синхронизация источников ещё не выполнялась."}
                {stats.visibleAuctions ? ` В публичной выдаче: ${stats.visibleAuctions} лотов.` : " Публичная выдача пуста: проверьте импорт и статусы лотов."}
              </Text>
            </Group>
          </Paper>
        )}

        <Select
          label="Статус заявки"
          data={[{ value: "", label: "Все" }, ...STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
          value={status}
          onChange={(value) => setStatus(value || "")}
          size="sm"
          w={200}
        />

        {isLoading ? <Center py={60}><Loader size="sm" color="orange" /></Center> :
         error ? <AsyncErrorState title="Не удалось загрузить заявки" description="Проверьте соединение и повторите запрос." onRetry={() => void mutate()} /> :
         inquiries.length === 0 ? <Paper radius="md" p="xl" withBorder><Center><Text c="gray.5">Нет заявок</Text></Center></Paper> :
         <Stack gap="xs">
          {inquiries.map((inq) => {
            const v = inq.auctionListing
            const image = isSafeMediaUrl(v?.imageUrl) ? v.imageUrl : ""
            const statusCfg = STATUSES.find((s) => s.value === inq.status) || STATUSES[0]
            return (
              <Paper key={inq.id} radius="md" p="md" withBorder>
                <Group gap="md" align="flex-start" wrap="nowrap">
                  <Box style={{ width: 80, height: 60, borderRadius: 8, overflow: "hidden", background: "var(--mantine-color-gray-1)", flexShrink: 0, position: "relative" }}>
                    <VehicleFallback type="CAR" compact />
                    {image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={(event) => { event.currentTarget.style.display = "none" }} />
                    )}
                  </Box>
                  <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="sm" align="center">
                      <Text fw={700} fz="sm" c="dark.9">{v ? `${v.make} ${v.model} ${v.year}` : "Авто"}</Text>
                      <Badge size="xs" variant="light" color={statusCfg.color}>{statusCfg.label}</Badge>
                      {v && <Badge size="xs" variant="light" color="orange">{v.source}</Badge>}
                    </Group>
                    <Group gap="md">
                      <Group gap={4}><IconPhone size={13} color="#71717a" /><Text size="xs" fw={600} c="dark.9">{inq.phone}</Text></Group>
                      <Text size="xs" c="gray.5">{inq.name}</Text>
                      {inq.email && <Group gap={4}><IconMail size={13} color="#71717a" /><Text size="xs" c="gray.5">{inq.email}</Text></Group>}
                      {inq.city && <Group gap={4}><IconMapPin size={13} color="#71717a" /><Text size="xs" c="gray.5">{inq.city}</Text></Group>}
                    </Group>
                    {inq.comment && <Text size="xs" c="gray.6" fs="italic">"{inq.comment}"</Text>}
                    <Group gap={4}>
                      <IconClock size={12} color="#a1a1aa" />
                      <Text size="10px" c="gray.4">{formatRelativeDate(inq.createdAt)}</Text>
                      {v && <Text size="10px" c="gray.4">· Цена: {(v.finalPrice || 0).toLocaleString("ru")}₽</Text>}
                    </Group>
                  </Stack>
                </Group>
              </Paper>
            )
          })}
        </Stack>}
      </Stack>
    </Box>
  )
}
