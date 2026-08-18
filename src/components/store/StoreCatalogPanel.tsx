"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  ActionIcon, Alert, Badge, Box, Button, Card, Group, Loader, Modal, NumberInput, Select,
  Stack, Table, Text, TextInput, ThemeIcon,
} from "@mantine/core"
import { IconEdit, IconPackage, IconSearch, IconTrash } from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

type StorePart = {
  id: string
  name: string
  price: number
  oemNumber: string | null
  brandName: string | null
  partType: string
  condition: string
  supplyMode: string
  leadTimeDaysMin: number | null
  leadTimeDaysMax: number | null
  make: string
  model: string
}

const PART_TYPE_LABELS: Record<string, string> = {
  ENGINE: "Двигатель", TRANSMISSION: "Трансмиссия", SUSPENSION: "Подвеска", BRAKES: "Тормоза",
  ELECTRICAL: "Электрика", BODY: "Кузов", INTERIOR: "Салон", WHEELS: "Колёса", LIGHTING: "Оптика",
  COOLING: "Охлаждение", EXHAUST: "Выхлоп", STEERING: "Рулевое", ACCESSORIES: "Аксессуары",
  CONSUMABLES: "Расходники", OTHER: "Другое",
}

export default function StoreCatalogPanel({ storeId }: { storeId: string }) {
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const { data, error, isLoading, mutate } = useSWR<{ parts: StorePart[] }>(
    `/api/stores/${storeId}/parts${appliedQuery ? `?q=${encodeURIComponent(appliedQuery)}` : ""}`,
    fetchJson,
    { revalidateOnFocus: false },
  )

  const [editTarget, setEditTarget] = useState<StorePart | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StorePart | null>(null)
  const [form, setForm] = useState({ name: "", price: 0 as string | number, supplyMode: "ORDER", leadMin: "" as string | number, leadMax: "" as string | number })
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const openEditor = (part: StorePart) => {
    setEditTarget(part)
    setActionError(null)
    setForm({
      name: part.name,
      price: part.price,
      supplyMode: part.supplyMode,
      leadMin: part.leadTimeDaysMin ?? "",
      leadMax: part.leadTimeDaysMax ?? "",
    })
  }

  const save = async () => {
    if (!editTarget) return
    setIsSaving(true)
    setActionError(null)
    try {
      const response = await fetch(`/api/stores/${storeId}/parts`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partId: editTarget.id,
          name: form.name,
          price: Number(form.price),
          supplyMode: form.supplyMode,
          leadTimeDaysMin: form.leadMin === "" ? null : Number(form.leadMin),
          leadTimeDaysMax: form.leadMax === "" ? null : Number(form.leadMax),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setActionError(typeof payload?.error === "string" ? payload.error : "Не удалось сохранить позицию")
        return
      }
      setEditTarget(null)
      await mutate()
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/stores/${storeId}/parts?partId=${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setActionError(typeof payload?.error === "string" ? payload.error : "Не удалось удалить позицию")
        return
      }
      setDeleteTarget(null)
      await mutate()
    } finally {
      setIsSaving(false)
    }
  }

  const parts = data?.parts || []

  return (
    <Card withBorder radius="lg" p="md">
      <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
        <Group gap="sm">
          <ThemeIcon variant="light" color="indigo" size={34} radius="md"><IconPackage size={17} /></ThemeIcon>
          <Box>
            <Text fw={750} size="sm">Каталог магазина</Text>
            <Text size="xs" c="dimmed">Правка цены, срока и наличия по одной позиции.</Text>
          </Box>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            placeholder="Название или артикул"
            leftSection={<IconSearch size={14} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => { if (event.key === "Enter") setAppliedQuery(query.trim()) }}
            w={220}
          />
          <Button size="xs" variant="light" color="indigo" onClick={() => setAppliedQuery(query.trim())}>Найти</Button>
        </Group>
      </Group>

      {actionError && <Alert color="red" variant="light" mb="sm">{actionError}</Alert>}

      {error ? (
        <AsyncErrorState title="Каталог недоступен" description="Не удалось загрузить позиции." onRetry={() => mutate()} />
      ) : isLoading ? (
        <Group justify="center" py="lg"><Loader size="sm" /></Group>
      ) : parts.length ? (
        <Box style={{ overflowX: "auto" }}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Название</Table.Th>
                <Table.Th>Артикул</Table.Th>
                <Table.Th>Категория</Table.Th>
                <Table.Th>Наличие</Table.Th>
                <Table.Th ta="right">Цена</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {parts.map((part) => (
                <Table.Tr key={part.id}>
                  <Table.Td>
                    <Text size="sm" fw={600} lineClamp={1}>{part.name}</Text>
                    <Text size="10px" c="dimmed">{part.make} {part.model}</Text>
                  </Table.Td>
                  <Table.Td><Text size="xs">{part.oemNumber || "—"}</Text></Table.Td>
                  <Table.Td><Text size="xs">{PART_TYPE_LABELS[part.partType] || part.partType}</Text></Table.Td>
                  <Table.Td>
                    {part.supplyMode === "STOCK"
                      ? <Badge size="xs" variant="light" color="teal">В наличии</Badge>
                      : <Badge size="xs" variant="light" color="orange">
                          {part.leadTimeDaysMin ? `${part.leadTimeDaysMin}–${part.leadTimeDaysMax || part.leadTimeDaysMin} дн` : "Под заказ"}
                        </Badge>}
                  </Table.Td>
                  <Table.Td ta="right"><Text size="sm" fw={700}>{part.price.toLocaleString("ru-RU")} ₽</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap" justify="flex-end">
                      <ActionIcon variant="light" color="indigo" size="sm" aria-label={`Изменить ${part.name}`} onClick={() => openEditor(part)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" size="sm" aria-label={`Удалить ${part.name}`} onClick={() => { setDeleteTarget(part); setActionError(null) }}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {parts.length === 50 && (
            <Text size="xs" c="dimmed" mt={6}>Показаны последние 50 позиций. Уточните поиск, чтобы найти нужную.</Text>
          )}
        </Box>
      ) : (
        <Text size="sm" c="dimmed">
          {appliedQuery ? "По запросу ничего не найдено." : "Каталог пуст. Загрузите прайс-лист ниже."}
        </Text>
      )}

      <Modal opened={Boolean(editTarget)} onClose={() => setEditTarget(null)} title="Изменить позицию" centered>
        <Stack gap="sm">
          <TextInput label="Название" value={form.name} onChange={(event) => setForm({ ...form, name: event.currentTarget.value })} />
          <NumberInput label="Цена, ₽" min={1} value={form.price} onChange={(value) => setForm({ ...form, price: value })} thousandSeparator=" " />
          <Select
            label="Наличие"
            data={[{ value: "STOCK", label: "В наличии" }, { value: "ORDER", label: "Под заказ" }]}
            value={form.supplyMode}
            onChange={(value) => setForm({ ...form, supplyMode: value || "ORDER" })}
            allowDeselect={false}
          />
          {form.supplyMode === "ORDER" && (
            <Group gap="sm" grow>
              <NumberInput label="Срок от, дней" min={0} max={365} value={form.leadMin} onChange={(value) => setForm({ ...form, leadMin: value })} />
              <NumberInput label="Срок до, дней" min={0} max={365} value={form.leadMax} onChange={(value) => setForm({ ...form, leadMax: value })} />
            </Group>
          )}
          {actionError && <Alert color="red" variant="light">{actionError}</Alert>}
          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setEditTarget(null)}>Отмена</Button>
            <Button color="indigo" onClick={save} loading={isSaving} disabled={!String(form.name).trim() || !Number(form.price)}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Удалить позицию?" centered>
        <Stack gap="sm">
          <Text size="sm">«{deleteTarget?.name}» исчезнет из витрины. Уже оформленные заказы сохранятся.</Text>
          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button color="red" onClick={remove} loading={isSaving} leftSection={<IconTrash size={15} />}>Удалить</Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}
