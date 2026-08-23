"use client"

import { useDeferredValue, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { notifications } from "@mantine/notifications"
import { Badge, Box, Button, Group, Image, Modal, Paper, SegmentedControl, Stack, Text, TextInput, Textarea } from "@mantine/core"
import { IconEye, IconEyeOff, IconSearch } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { formatPriceShort } from "@/lib/format"

type AuctionLot = {
  id: string; make: string; model: string; year: number; source: string; lotNumber: string | null
  status: string; finalPrice: number; imageUrl: string | null; adminHiddenAt: string | null; adminHiddenReason: string | null
}

export default function AuctionLotAdministration() {
  const [visibility, setVisibility] = useState<"visible" | "hidden">("visible")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim())
  const { data, error, isLoading, mutate } = useSWR<{ lots: AuctionLot[] }>(`/api/admin/auctions/lots?visibility=${visibility}${deferredQuery ? `&q=${encodeURIComponent(deferredQuery)}` : ""}`, fetchJson)
  const [selected, setSelected] = useState<AuctionLot | null>(null)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  const changeVisibility = async (lot: AuctionLot, action: "HIDE" | "RESTORE") => {
    if (action === "HIDE" && reason.trim().length < 3) return
    setSaving(true)
    try {
      await fetchJson("/api/admin/auctions/lots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lot.id, action, reason }) })
      notifications.show({ title: action === "HIDE" ? "Лот скрыт" : "Лот восстановлен", message: action === "HIDE" ? "Он сразу исчез из каталога и SEO-выдачи." : "Он снова доступен, если актуален у источника.", color: "teal" })
      setSelected(null); setReason(""); await mutate()
    } catch (mutationError) {
      notifications.show({ title: "Действие не выполнено", message: mutationError instanceof Error ? mutationError.message : "Повторите запрос", color: "red" })
    } finally { setSaving(false) }
  }

  return <Paper withBorder radius="md" p="md">
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end" gap="sm" wrap="wrap">
        <Box><Text fw={800}>Управление аукционными лотами</Text><Text size="xs" c="dimmed">Ручное скрытие сохраняется после новых запусков парсеров.</Text></Box>
        <Group gap="xs" wrap="wrap"><TextInput value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Марка, модель или № лота" leftSection={<IconSearch size={15} />} size="xs" /><SegmentedControl size="xs" value={visibility} onChange={(value) => setVisibility(value as "visible" | "hidden")} data={[{ label: "В каталоге", value: "visible" }, { label: "Скрытые", value: "hidden" }]} /></Group>
      </Group>
      {isLoading ? <Text size="sm" c="dimmed">Загружаем лоты…</Text> : error ? <Text size="sm" c="red">Не удалось загрузить лоты.</Text> : data?.lots.length ? <Stack gap={6} mah={430} style={{ overflowY: "auto" }}>{data.lots.map((lot) => <Paper key={lot.id} withBorder radius="md" p="xs"><Group justify="space-between" gap="sm" wrap="nowrap"><Group gap="sm" wrap="nowrap" miw={0}>{lot.imageUrl && <Image src={lot.imageUrl} w={54} h={42} radius="sm" fit="cover" alt="" />}<Box miw={0}><Group gap={5} wrap="wrap"><Text size="sm" fw={700} lineClamp={1}>{lot.make} {lot.model} {lot.year}</Text><Badge size="xs" variant="light" color="orange">{lot.source}</Badge></Group><Text size="xs" c="dimmed">{lot.lotNumber ? `Лот ${lot.lotNumber} · ` : ""}{formatPriceShort(lot.finalPrice)}{lot.adminHiddenReason ? ` · ${lot.adminHiddenReason}` : ""}</Text></Box></Group><Group gap={5} wrap="nowrap"><Button component={Link} href={`/auctions/${lot.id}`} target="_blank" size="compact-xs" variant="subtle">Открыть</Button><Button size="compact-xs" variant="light" color={lot.adminHiddenAt ? "teal" : "red"} leftSection={lot.adminHiddenAt ? <IconEye size={13} /> : <IconEyeOff size={13} />} onClick={() => lot.adminHiddenAt ? void changeVisibility(lot, "RESTORE") : setSelected(lot)}>{lot.adminHiddenAt ? "Вернуть" : "Скрыть"}</Button></Group></Group></Paper>)}</Stack> : <Text size="sm" c="dimmed">В этом разделе лотов нет.</Text>}
    </Stack>
    <Modal opened={Boolean(selected)} onClose={() => !saving && setSelected(null)} title="Скрыть аукционный лот" centered><Stack><Text size="sm" c="dimmed">Лот исчезнет из каталога, карточки и поисковой выдачи. Парсер не отменит это решение.</Text><Textarea label="Причина" placeholder="Например: неверные данные источника" value={reason} onChange={(event) => setReason(event.currentTarget.value)} minRows={3} required /><Group justify="flex-end"><Button variant="default" onClick={() => setSelected(null)}>Отмена</Button><Button color="red" loading={saving} disabled={reason.trim().length < 3} onClick={() => selected && void changeVisibility(selected, "HIDE")}>Скрыть лот</Button></Group></Stack></Modal>
  </Paper>
}
