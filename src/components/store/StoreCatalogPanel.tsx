"use client"

import { PART_TYPES } from "@/lib/constants"
import { useState } from "react"
import useSWR from "swr"
import {
  ActionIcon, Alert, Badge, Box, Button, Card, Divider, Group, Loader, Modal, NumberInput, SegmentedControl, Select,
  SimpleGrid, Stack, Table, Text, TextInput, Textarea, ThemeIcon,
} from "@mantine/core"
import { IconEdit, IconPackage, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"
import { detectProductGroup } from "@/lib/product-groups"
import ProductAttributesFields, { attributesToForm } from "@/components/store/ProductAttributesFields"
import ProductPhotosField from "@/components/store/ProductPhotosField"
import ProductLegalFields, { EMPTY_LEGAL, legalToForm, type LegalFormValues } from "@/components/store/ProductLegalFields"
import { checkLegal } from "@/lib/product-legal"
import { getBrandsByCategory, getModels } from "@/lib/catalog"

/* Марки для поля «Для какой машины» — один раз, а не на каждую букву. */
const CAR_BRANDS = getBrandsByCategory("cars").map((brand) => brand.name)

function parseImageList(value: string | null | undefined): string[] {
  try {
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === "string") : []
  } catch {
    return []
  }
}

/* Подзаголовок раздела формы: форма длинная, без деления читается анкетой. */
function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fw={800} size="sm">{title}</Text>
      {hint && <Text size="xs" c="dimmed" mb={8}>{hint}</Text>}
      <Stack gap="sm" mt={hint ? 0 : 8}>{children}</Stack>
    </Box>
  )
}

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
  condition: string
  images?: string | null
  description?: string | null
  gtin?: string | null
  manufacturerInfo?: string | null
  warrantyMonths?: number | null
  shelfLife?: string | null
  safetyInfo?: string | null
  originCountry?: string | null
  conformityType?: string | null
  conformityRegulation?: string | null
  conformityNumber?: string | null
  conformityValidUntil?: string | null
  conformityUrl?: string | null
  productGroup?: string | null
  attributes?: Array<{ key: string; num: number | null; text: string | null }>
}

/* Подписи берутся из общего словаря PART_TYPES: локальная копия
   разошлась с ним — тип OTHER подписывался «Запчасти» на витрине и
   «Другое» в кабинете. */
const PART_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PART_TYPES.map((type) => [type.value, type.label]),
)

/* onChanged — кабинету: число позиций решает, доступна ли кнопка «Отправить
   на проверку». Раньше после ручного добавления она оставалась заблокированной
   до перезагрузки страницы. */
export default function StoreCatalogPanel({ storeId, onChanged }: { storeId: string; onChanged?: () => void }) {
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const { data, error, isLoading, mutate } = useSWR<{ parts: StorePart[] }>(
    `/api/stores/${storeId}/parts${appliedQuery ? `?q=${encodeURIComponent(appliedQuery)}` : ""}`,
    fetchJson,
    { revalidateOnFocus: false },
  )

  const [editTarget, setEditTarget] = useState<StorePart | null>(null)
  /* Добавление позиции руками.

     Единственным способом наполнить каталог был импорт файла: продавец
     с пятью деталями упирался в заблокированную кнопку «Отправить на
     проверку» и должен был сверстать таблицу, чтобы продать одну
     колодку. Форма здесь та же, что и для правки, — поля совпадают. */
  const [isCreating, setIsCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<StorePart | null>(null)
  const emptyForm = { name: "", price: "" as string | number, supplyMode: "ORDER", leadMin: "" as string | number, leadMax: "" as string | number, oemNumber: "", brandName: "", description: "", condition: "NEW", make: null as string | null, model: null as string | null, images: [] as string[] }
  const [form, setForm] = useState(emptyForm)
  /* Группа и характеристики: выбранная вручную группа не перебивается
     догадкой по названию. */
  const [productGroup, setProductGroup] = useState<string | null>(null)
  const [groupTouched, setGroupTouched] = useState(false)
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [legalValues, setLegalValues] = useState<LegalFormValues>(EMPTY_LEGAL)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  /* Подсказки закона считаются прямо в форме — продавец видит их до
     отправки, а не после ответа сервера. */
  const legalWarnings = checkLegal(productGroup, { ...legalValues, brandName: form.brandName, condition: form.condition }).warnings

  const openEditor = (part: StorePart) => {
    setEditTarget(part)
    setActionError(null)
    setForm({
      name: part.name,
      price: part.price,
      supplyMode: part.supplyMode,
      leadMin: part.leadTimeDaysMin ?? "",
      leadMax: part.leadTimeDaysMax ?? "",
      oemNumber: part.oemNumber ?? "",
      brandName: part.brandName ?? "",
      description: part.description ?? "",
      condition: part.condition === "USED" ? "USED" : "NEW",
      make: part.make && part.make !== "Универсальная" ? part.make : null,
      model: part.model && part.model !== "—" ? part.model : null,
      images: parseImageList(part.images),
    })
    setProductGroup(part.productGroup ?? null)
    setGroupTouched(Boolean(part.productGroup))
    setAttributeValues(attributesToForm(part.attributes))
    setLegalValues(legalToForm(part))
    setFieldErrors({})
  }

  const save = async () => {
    if (!editTarget && !isCreating) return
    setIsSaving(true)
    setActionError(null)
    try {
      const response = await fetch(`/api/stores/${storeId}/parts`, {
        method: isCreating ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(editTarget ? { partId: editTarget.id } : {}),
          name: form.name,
          price: Number(form.price),
          supplyMode: form.supplyMode,
          leadTimeDaysMin: form.leadMin === "" ? null : Number(form.leadMin),
          leadTimeDaysMax: form.leadMax === "" ? null : Number(form.leadMax),
          oemNumber: form.oemNumber,
          brandName: form.brandName,
          description: form.description,
          condition: form.condition,
          make: form.make ?? "",
          model: form.model ?? "",
          images: form.images,
          productGroup: productGroup ?? "",
          attributes: attributeValues,
          ...legalValues,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setFieldErrors(payload?.fieldErrors || {})
        setActionError(typeof payload?.error === "string" ? payload.error : "Не удалось сохранить позицию")
        return
      }
      setFieldErrors({})
      setEditTarget(null)
      setIsCreating(false)
      await mutate()
      onChanged?.()
    } finally {
      setIsSaving(false)
    }
  }

  /** Открывает пустую форму: новая позиция «под заказ» без срока. */
  const startCreating = () => {
    setForm(emptyForm)
    setLegalValues(EMPTY_LEGAL)
    setFieldErrors({})
    setProductGroup(null)
    setGroupTouched(false)
    setAttributeValues({})
    setActionError(null)
    setIsCreating(true)
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
      onChanged?.()
    } finally {
      setIsSaving(false)
    }
  }

  const parts = data?.parts || []

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
        <Group gap="sm">
          <ThemeIcon variant="light" color="indigo" size={34} radius="md"><IconPackage size={17} /></ThemeIcon>
          <Box>
            <Text fw={700} size="sm">Каталог магазина</Text>
            <Text size="xs" c="dimmed">Добавление и правка позиций по одной, без файла.</Text>
          </Box>
        </Group>
        <Group gap="xs" wrap="nowrap">
          {/* Добавить позицию руками.

              Наполнить каталог можно было только импортом таблицы:
              продавец с пятью деталями упирался в заблокированную
              кнопку «Отправить на проверку» и должен был верстать CSV,
              чтобы продать одну колодку. */}
          <Button size="xs" color="indigo" leftSection={<IconPlus size={14} />} onClick={startCreating}>
            Добавить
          </Button>
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
        /* Прокрутка с наименьшей шириной: без неё шесть колонок сжимались
           вместо прокрутки, и цена — то, ради чего каталог и открывают —
           превращалась в нечитаемую щель. */
        <Table.ScrollContainer minWidth={760}>
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
                    <Text size="var(--text-caps)" c="dimmed">{part.make} {part.model}</Text>
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
                    {/* Кнопки крупнее и с просветом.

                        Были по двадцать шесть точек вплотную друг к другу —
                        вдвое меньше нормы для пальца, и промах по «Изменить»
                        попадал в «Удалить». Продавец правит каталог с
                        телефона между делом, и цена ошибки здесь — потерянная
                        позиция. */}
                    <Group gap={8} wrap="nowrap" justify="flex-end">
                      <ActionIcon variant="light" color="indigo" size="lg" aria-label={`Изменить ${part.name}`} onClick={() => openEditor(part)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" size="lg" aria-label={`Удалить ${part.name}`} onClick={() => { setDeleteTarget(part); setActionError(null) }}>
                        <IconTrash size={16} />
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
        </Table.ScrollContainer>
      ) : (
        <Text size="sm" c="dimmed">
          {/* Текст гнал к прайс-листу, хотя кнопка «Добавить позицию» стоит
              рядом, а на телефоне файла с прайсом взять неоткуда. */}
          {appliedQuery ? "По запросу ничего не найдено." : "Каталог пуст. Добавьте первую позицию кнопкой выше — или загрузите прайс-листом, если позиций много."}
        </Text>
      )}

      <Modal
        opened={Boolean(editTarget) || isCreating}
        onClose={() => { setEditTarget(null); setIsCreating(false) }}
        title={isCreating ? "Новая позиция" : "Изменить позицию"}
        centered
        size="xl"
        /* В форме несколько полей: промах мимо окна не должен стирать
           набранное. Крестик и «Отмена» остаются. */
        closeOnClickOutside={false}
      >
        <Stack gap="lg">
          <FormSection title="Основное">
            <TextInput
              label="Название"
              placeholder="Масло моторное ZIC X9 5W-40 4 л"
              description="Как в прайсе: марку, артикул и объём лучше писать в названии — характеристики заполнятся сами"
              value={form.name}
              onChange={(event) => {
                const name = event.currentTarget.value
                setForm({ ...form, name })
                if (!groupTouched) setProductGroup(detectProductGroup(name)?.key ?? null)
              }}
            />
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
              <TextInput label="Артикул" value={form.oemNumber} onChange={(event) => setForm({ ...form, oemNumber: event.currentTarget.value })} />
              <TextInput label="Производитель" placeholder="ZIC, Bosch, Toyota" value={form.brandName} onChange={(event) => setForm({ ...form, brandName: event.currentTarget.value })} error={fieldErrors.brandName} />
              <NumberInput label="Цена, ₽" min={1} value={form.price} onChange={(value) => setForm({ ...form, price: value })} thousandSeparator=" " />
              <Select
                label="Наличие"
                data={[{ value: "STOCK", label: "В наличии" }, { value: "ORDER", label: "Под заказ" }]}
                value={form.supplyMode}
                onChange={(value) => setForm({ ...form, supplyMode: value || "ORDER" })}
                allowDeselect={false}
              />
            </SimpleGrid>
            {form.supplyMode === "ORDER" && (
              <Group gap="sm" grow>
                <NumberInput label="Срок от, дней" min={0} max={365} value={form.leadMin} onChange={(value) => setForm({ ...form, leadMin: value })} />
                <NumberInput label="Срок до, дней" min={0} max={365} value={form.leadMax} onChange={(value) => setForm({ ...form, leadMax: value })} />
              </Group>
            )}
            <SegmentedControl
              value={form.condition}
              onChange={(value) => setForm({ ...form, condition: value })}
              data={[{ value: "NEW", label: "Новый" }, { value: "USED", label: "Б/у" }]}
            />
          </FormSection>

          <Divider />
          <FormSection title="Фото" hint="Карточки с фото открывают чаще. Первое фото — обложка.">
            <ProductPhotosField value={form.images} onChange={(images) => setForm((current) => ({ ...current, images }))} />
          </FormSection>

          <Divider />
          <FormSection title="Для какой машины" hint="Не указали — позиция считается универсальной (масла, химия, аксессуары).">
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
              <Select label="Марка" placeholder="Универсальная" data={CAR_BRANDS} searchable clearable value={form.make} onChange={(make) => setForm({ ...form, make, model: null })} />
              <Select label="Модель" placeholder={form.make ? "Любая модель" : "Сначала марка"} data={form.make ? getModels(form.make, "cars") : []} searchable clearable disabled={!form.make} value={form.model} onChange={(model) => setForm({ ...form, model })} />
            </SimpleGrid>
          </FormSection>

          <Divider />
          <FormSection title="Группа и характеристики">
            <ProductAttributesFields
              name={form.name}
              group={productGroup}
              values={attributeValues}
              onGroupChange={(next) => { setProductGroup(next); setGroupTouched(true) }}
              onValuesChange={setAttributeValues}
            />
            {fieldErrors.productGroup && <Alert color="red" variant="light">{fieldErrors.productGroup}</Alert>}
          </FormSection>

          <Divider />
          <ProductLegalFields
            group={productGroup}
            condition={form.condition}
            values={legalValues}
            errors={fieldErrors}
            onChange={setLegalValues}
          />

          <Divider />
          <FormSection title="Описание">
            <Textarea
              placeholder="Применимость, комплектация, условия гарантии и возврата"
              autosize minRows={3} maxRows={10} maxLength={2000}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.currentTarget.value })}
            />
          </FormSection>

          {legalWarnings.length > 0 && (
            <Alert color="yellow" variant="light" title="Проверьте перед публикацией">
              <Stack gap={4}>{legalWarnings.map((warning) => <Text key={warning} size="sm">{warning}</Text>)}</Stack>
            </Alert>
          )}
          {actionError && <Alert color="red" variant="light">{actionError}</Alert>}
          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => { setEditTarget(null); setIsCreating(false) }}>Отмена</Button>
            <Button color="indigo" onClick={save} loading={isSaving} disabled={!String(form.name).trim() || !Number(form.price)}>
              {isCreating ? "Добавить" : "Сохранить"}
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
