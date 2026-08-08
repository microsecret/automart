"use client"
export const dynamic = "force-dynamic"
import useSWR from "swr"
import { Box, Stack, Group, Text, Paper, Badge, Center, Loader, ThemeIcon, Select } from "@mantine/core"
import { IconGavel, IconPhone, IconMail, IconMapPin, IconClock } from "@tabler/icons-react"
import { formatRelativeDate } from "@/lib/format"
import { useState } from "react"

const fetcher = (url) => fetch(url).then((r) => r.json())
const STATUSES = [
  { value: "NEW", label: "Новые", color: "red" },
  { value: "CONTACTED", label: "Связались", color: "orange" },
  { value: "IN_PROGRESS", label: "В работе", color: "blue" },
  { value: "CLOSED", label: "Закрыто", color: "gray" },
  { value: "SOLD", label: "Продано", color: "green" },
]

export default function AdminAuctionsPage() {
  const [status, setStatus] = useState("NEW")
  const { data, isLoading } = useSWR(`/api/admin/auctions/inquiries${status ? `?status=${status}` : ""}`, fetcher)
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

        <Select
          label="Статус заявки"
          data={[{ value: "", label: "Все" }, ...STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
          value={status}
          onChange={setStatus}
          size="sm"
          w={200}
        />

        {isLoading ? <Center py={60}><Loader size="sm" color="orange" /></Center> :
         inquiries.length === 0 ? <Paper radius="md" p="xl" withBorder><Center><Text c="gray.5">Нет заявок</Text></Center></Paper> :
         <Stack gap="xs">
          {inquiries.map((inq) => {
            const v = inq.auctionListing
            const statusCfg = STATUSES.find((s) => s.value === inq.status) || STATUSES[0]
            return (
              <Paper key={inq.id} radius="md" p="md" withBorder>
                <Group gap="md" align="flex-start" wrap="nowrap">
                  <Box style={{ width: 80, height: 60, borderRadius: 8, overflow: "hidden", background: "var(--mantine-color-gray-1)", flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v?.imageUrl || "/placeholder.svg"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
