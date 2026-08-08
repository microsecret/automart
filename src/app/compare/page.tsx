"use client"
export const dynamic = "force-dynamic"

import { useState } from "react"
import { Container, Stack, Text, Group, Box, Paper, Button, SimpleGrid, Center, Loader, ThemeIcon, Divider, Table } from "@mantine/core"
import { IconGitCompare, IconX, IconPlus } from "@tabler/icons-react"
import Link from "next/link"
import useSWR from "swr"
import { formatPrice, formatPriceShort, formatMileage } from "@/lib/format"
import { findLabel, BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants"
import BrandLogo from "@/components/brands/BrandLogo"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ComparePage() {
  const [ids, setIds] = useState<string[]>([])

  const { data, isLoading } = useSWR<{ listings: any[] }>(
    ids.length > 0 ? `/api/listings?ids=${ids.join(",")}&limit=10` : null,
    fetcher
  )

  const vehicles = data?.listings?.filter((l) => l.vehicle) || []

  const removeItem = (id: string) => setIds(ids.filter((x) => x !== id))

  return (
    <Container size="xl" py="md" px={{ base: "md", md: "lg" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconGitCompare size={20} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" ff="var(--font-display),sans-serif" fw={800} fz={{ base: 20, md: 24 }} c="#18181b">
              Сравнение
            </Text>
            <Text size="xs" c="#71717a">{vehicles.length} из 10 объявлений</Text>
          </Stack>
        </Group>

        {vehicles.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="md">
              <IconGitCompare size={40} stroke={1.5} color="#d4d4d8" />
              <Stack gap={4} align="center">
                <Text fw={500} c="#52525b">Список сравнения пуст</Text>
                <Text size="sm" c="#a1a1aa">Добавляйте объявления к сравнению со страницы объявления</Text>
              </Stack>
              <Button component={Link} href="/" variant="light" color="indigo" size="sm">К объявлениям</Button>
            </Stack>
          </Center>
        ) : (
          <Paper withBorder radius="md" style={{ overflow: "hidden", borderColor: "#f4f4f5" }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 140 }}>Характеристика</Table.Th>
                  {vehicles.map((v) => (
                    <Table.Th key={v.id} style={{ minWidth: 180 }}>
                      <Group gap="xs" align="center" wrap="nowrap">
                        <Box style={{ width: 24, height: 24, flexShrink: 0 }}>{v.vehicle?.make && <BrandLogo brand={v.vehicle.make} size={22} color="#3f3f46" />}</Box>
                        <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                          <Text size="xs" fw={600} c="#18181b" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</Text>
                        </Stack>
                        <IconX size={14} color="#a1a1aa" style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => removeItem(v.id)} />
                      </Group>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <CompareRow label="Цена" values={vehicles.map((v) => formatPrice(v.price))} bold />
                <CompareRow label="Год" values={vehicles.map((v) => String(v.vehicle?.year || "—"))} />
                <CompareRow label="Пробег" values={vehicles.map((v) => v.vehicle ? formatMileage(v.vehicle.mileage) : "—")} />
                <CompareRow label="Кузов" values={vehicles.map((v) => v.vehicle?.bodyType ? findLabel(BODY_TYPES, v.vehicle.bodyType) : "—")} />
                <CompareRow label="Двигатель" values={vehicles.map((v) => v.vehicle?.fuelType ? findLabel(FUEL_TYPES, v.vehicle.fuelType) : "—")} />
                <CompareRow label="Коробка" values={vehicles.map((v) => v.vehicle?.transmission ? findLabel(TRANSMISSIONS, v.vehicle.transmission) : "—")} />
                <CompareRow label="Город" values={vehicles.map((v) => v.location || "—")} />
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>
    </Container>
  )
}

function CompareRow({ label, values, bold }: { label: string; values: string[]; bold?: boolean }) {
  return (
    <Table.Tr>
      <Table.Td style={{ fontWeight: 600, color: "#71717a", fontSize: "0.8125rem" }}>{label}</Table.Td>
      {values.map((v, i) => (
        <Table.Td key={i} style={{ fontWeight: bold ? 700 : 400, color: bold ? "#4f46e5" : "#18181b", fontSize: "0.8125rem" }}>{v}</Table.Td>
      ))}
    </Table.Tr>
  )
}
