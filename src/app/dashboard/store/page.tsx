"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Alert, Badge, Box, Button, Card, Container, Divider, FileInput, Group, Loader, Modal,
  Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, ThemeIcon, Title,
} from "@mantine/core"
import {
  IconAlertTriangle, IconBuildingStore, IconCheck, IconFileSpreadsheet, IconPlus, IconTrash, IconUpload,
} from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

type Store = {
  id: string
  name: string
  slug: string
  description: string | null
  city: string | null
  status: string
  statusReason: string | null
  legalName: string | null
  inn: string | null
  contactPhone: string | null
  contactEmail: string | null
  defaultLeadTimeDaysMin: number | null
  defaultLeadTimeDaysMax: number | null
  defaultOriginCountry: string | null
  createdAt: string
  _count: { parts: number }
}

type PreviewRow = {
  line: number
  name: string
  price: number
  oemNumber: string | null
  brandName: string | null
  make: string | null
  model: string | null
  partType: string
  condition: "NEW" | "USED"
  supplyMode: "STOCK" | "ORDER"
  leadTimeDaysMin: number | null
  leadTimeDaysMax: number | null
  description: string | null
}

type ImportPreview = {
  batchId: string
  totalRows: number
  readyRows: number
  skippedRows: number
  preview: PreviewRow[]
  errors: Array<{ line: number; reason: string; raw: string }>
}

const STATUS_META: Record<string, { label: string; color: string; hint: string }> = {
  DRAFT: { label: "Черновик", color: "gray", hint: "Витрина видна только вам. Отправьте на проверку, когда наполните каталог." },
  PENDING: { label: "На проверке", color: "orange", hint: "Заявка в очереди. Обычно проверка занимает один рабочий день." },
  ACTIVE: { label: "Опубликован", color: "teal", hint: "Витрина доступна покупателям и попадает в поиск по каталогу." },
  SUSPENDED: { label: "Приостановлен", color: "red", hint: "Публикация снята администратором. Причина указана ниже." },
}

const ORIGIN_OPTIONS = [
  { value: "CN", label: "Китай" },
  { value: "KR", label: "Корея" },
  { value: "JP", label: "Япония" },
  { value: "DE", label: "Европа" },
  { value: "RU", label: "Россия" },
]

const PART_TYPE_LABELS: Record<string, string> = {
  ENGINE: "Двигатель", TRANSMISSION: "Трансмиссия", SUSPENSION: "Подвеска", BRAKES: "Тормоза",
  ELECTRICAL: "Электрика", BODY: "Кузов", INTERIOR: "Салон", WHEELS: "Колёса", LIGHTING: "Оптика",
  COOLING: "Охлаждение", EXHAUST: "Выхлоп", STEERING: "Рулевое", ACCESSORIES: "Аксессуары",
  CONSUMABLES: "Расходники", OTHER: "Другое",
}

export default function StoreWorkspacePage() {
  const { data, error, isLoading, mutate } = useSWR<{ stores: Store[] }>("/api/stores", fetchJson, { revalidateOnFocus: false })
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState({ name: "", city: "", description: "", legalName: "", inn: "", contactPhone: "", contactEmail: "", defaultOriginCountry: "CN" as string | null })
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importState, setImportState] = useState<"idle" | "parsing" | "applying">("idle")
  const [lastApplied, setLastApplied] = useState<{ batchId: string; created: number } | null>(null)
  const [revertTarget, setRevertTarget] = useState<{ batchId: string; created: number } | null>(null)

  const store = data?.stores?.[0] || null

  const createStore = async () => {
    if (form.name.trim().length < 3) {
      setSaveError("Укажите название магазина от трёх символов")
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const response = await fetch("/api/stores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setSaveError(typeof payload?.error === "string" ? payload.error : "Не удалось создать магазин")
        return
      }
      setIsCreating(false)
      await mutate()
    } catch (requestError) {
      setSaveError(getApiClientErrorMessage(requestError, "Нет связи с сервером. Попробуйте ещё раз."))
    } finally {
      setIsSaving(false)
    }
  }

  const parseFile = async () => {
    if (!store || !file) return
    setImportState("parsing")
    setImportError(null)
    setPreview(null)
    try {
      const body = new FormData()
      body.append("file", file)
      const response = await fetch(`/api/stores/${store.id}/import`, { method: "POST", body })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setImportError(typeof payload?.error === "string" ? payload.error : "Не удалось прочитать файл")
        if (Array.isArray(payload?.errors)) setPreview({ batchId: "", totalRows: 0, readyRows: 0, skippedRows: payload.errors.length, preview: [], errors: payload.errors })
        return
      }
      setPreview(payload as ImportPreview)
    } catch (requestError) {
      setImportError(getApiClientErrorMessage(requestError, "Не удалось передать файл на сервер."))
    } finally {
      setImportState("idle")
    }
  }

  const applyImport = async () => {
    if (!store || !preview?.batchId) return
    setImportState("applying")
    setImportError(null)
    try {
      const response = await fetch(`/api/stores/${store.id}/import`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId: preview.batchId, action: "APPLY", rows: preview.preview }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setImportError(typeof payload?.error === "string" ? payload.error : "Не удалось опубликовать позиции")
        return
      }
      setLastApplied({ batchId: preview.batchId, created: payload?.created || 0 })
      setPreview(null)
      setFile(null)
      await mutate()
    } catch (requestError) {
      setImportError(getApiClientErrorMessage(requestError, "Публикация не завершилась. Проверьте каталог перед повторной попыткой."))
    } finally {
      setImportState("idle")
    }
  }

  const revertImport = async () => {
    if (!store || !revertTarget) return
    setImportState("applying")
    try {
      const response = await fetch(`/api/stores/${store.id}/import`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId: revertTarget.batchId, action: "REVERT" }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setImportError(typeof payload?.error === "string" ? payload.error : "Не удалось откатить загрузку")
        return
      }
      setLastApplied(null)
      setRevertTarget(null)
      await mutate()
    } finally {
      setImportState("idle")
    }
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <AsyncErrorState title="Кабинет магазина недоступен" description="Не удалось загрузить данные витрины." onRetry={() => mutate()} />
      </Container>
    )
  }

  if (isLoading) {
    return <Container size="lg" py="xl"><Group justify="center"><Loader /></Group></Container>
  }

  const statusMeta = store ? STATUS_META[store.status] || STATUS_META.DRAFT : null

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="lg">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconBuildingStore size={22} /></ThemeIcon>
          <Box>
            <Title order={1} size="h3" ff="var(--font-display),sans-serif">Магазин запчастей</Title>
            <Text size="sm" c="dimmed">Витрина, каталог и массовая загрузка прайс-листа.</Text>
          </Box>
        </Group>

        {!store ? (
          <Card withBorder radius="lg" p="lg">
            {!isCreating ? (
              <Stack align="center" gap="sm" py="lg" ta="center" maw={520} mx="auto">
                <ThemeIcon variant="light" color="indigo" size={52} radius="md"><IconBuildingStore size={26} /></ThemeIcon>
                <Text fw={700}>У вас ещё нет витрины</Text>
                <Text size="sm" c="dimmed">
                  Магазин отделяет ваш каталог от частных объявлений: у него своя страница, реквизиты и
                  условия поставки. Позиции можно загрузить прайс-листом, а не заводить по одной.
                </Text>
                <Button color="indigo" leftSection={<IconPlus size={16} />} onClick={() => setIsCreating(true)}>
                  Создать магазин
                </Button>
              </Stack>
            ) : (
              <Stack gap="sm">
                <Text fw={750}>Новый магазин</Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput required label="Название магазина" placeholder="АвтоДеталь" value={form.name} onChange={(event) => setForm({ ...form, name: event.currentTarget.value })} />
                  <TextInput label="Город" placeholder="Москва" value={form.city} onChange={(event) => setForm({ ...form, city: event.currentTarget.value })} />
                  <TextInput label="Юридическое название" placeholder="ООО «АвтоДеталь»" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.currentTarget.value })} />
                  <TextInput label="ИНН" value={form.inn} onChange={(event) => setForm({ ...form, inn: event.currentTarget.value })} />
                  <TextInput label="Телефон" placeholder="+7 900 000-00-00" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.currentTarget.value })} />
                  <TextInput label="Email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.currentTarget.value })} />
                  <Select label="Основная страна поставки" data={ORIGIN_OPTIONS} value={form.defaultOriginCountry} onChange={(value) => setForm({ ...form, defaultOriginCountry: value })} />
                </SimpleGrid>
                <Textarea label="Описание" placeholder="Чем занимается магазин, какие марки везёте, сроки" autosize minRows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.currentTarget.value })} />
                {saveError && <Alert color="red" variant="light">{saveError}</Alert>}
                <Group gap="xs">
                  <Button color="indigo" onClick={createStore} loading={isSaving}>Создать</Button>
                  <Button variant="subtle" color="gray" onClick={() => { setIsCreating(false); setSaveError(null) }}>Отмена</Button>
                </Group>
              </Stack>
            )}
          </Card>
        ) : (
          <>
            <Card withBorder radius="lg" p="md">
              <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                <Box>
                  <Group gap="xs">
                    <Text fw={800} size="lg">{store.name}</Text>
                    {statusMeta && <Badge variant="light" color={statusMeta.color}>{statusMeta.label}</Badge>}
                  </Group>
                  <Text size="xs" c="dimmed" mt={2}>lewheel.ru/store/{store.slug}</Text>
                  {statusMeta && <Text size="sm" c="dimmed" mt={6} maw={560}>{statusMeta.hint}</Text>}
                  {store.statusReason && <Alert color="red" variant="light" mt="sm">{store.statusReason}</Alert>}
                </Box>
                <Card withBorder radius="md" p="sm" miw={160}>
                  <Text size="xs" c="dimmed">Позиций в каталоге</Text>
                  <Text fw={850} size="xl">{store._count.parts}</Text>
                </Card>
              </Group>
            </Card>

            <Card withBorder radius="lg" p="md">
              <Group gap="sm" mb="sm">
                <ThemeIcon variant="light" color="teal" size={34} radius="md"><IconFileSpreadsheet size={17} /></ThemeIcon>
                <Box>
                  <Text fw={750} size="sm">Загрузка прайс-листа</Text>
                  <Text size="xs" c="dimmed">CSV с колонками «Название» и «Цена». Остальные — по возможности.</Text>
                </Box>
              </Group>

              <Group gap="sm" align="flex-end" wrap="wrap">
                <FileInput
                  label="Файл прайс-листа"
                  placeholder="price.csv"
                  accept=".csv,text/csv,text/plain"
                  value={file}
                  onChange={setFile}
                  clearable
                  style={{ flex: 1, minWidth: 240 }}
                />
                <Button color="indigo" leftSection={<IconUpload size={16} />} onClick={parseFile} disabled={!file} loading={importState === "parsing"}>
                  Проверить файл
                </Button>
              </Group>

              <Text size="xs" c="dimmed" mt={8}>
                Файл сначала разбирается и показывается здесь. В каталог ничего не попадёт, пока вы не подтвердите публикацию.
              </Text>

              {importError && <Alert color="red" variant="light" mt="sm" icon={<IconAlertTriangle size={16} />}>{importError}</Alert>}

              {lastApplied && (
                <Alert color="teal" variant="light" mt="sm" icon={<IconCheck size={16} />}>
                  <Group justify="space-between" gap="sm" wrap="wrap">
                    <Text size="sm">Опубликовано {lastApplied.created} позиций.</Text>
                    <Button size="compact-xs" variant="light" color="red" leftSection={<IconTrash size={13} />} onClick={() => setRevertTarget(lastApplied)}>
                      Откатить загрузку
                    </Button>
                  </Group>
                </Alert>
              )}
            </Card>

            {preview && (
              <Card withBorder radius="lg" p="md">
                <Group justify="space-between" gap="sm" wrap="wrap" mb="sm">
                  <Box>
                    <Text fw={750} size="sm">Предпросмотр загрузки</Text>
                    <Text size="xs" c="dimmed">
                      Строк в файле: {preview.totalRows} · готовы к публикации: {preview.readyRows} · отклонено: {preview.skippedRows}
                    </Text>
                  </Box>
                  {preview.batchId && preview.readyRows > 0 && (
                    <Button color="teal" leftSection={<IconCheck size={16} />} onClick={applyImport} loading={importState === "applying"}>
                      Опубликовать {preview.readyRows} позиций
                    </Button>
                  )}
                </Group>

                {preview.preview.length > 0 && (
                  <Box style={{ overflowX: "auto" }}>
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Название</Table.Th>
                          <Table.Th>Артикул</Table.Th>
                          <Table.Th>Категория</Table.Th>
                          <Table.Th>Наличие</Table.Th>
                          <Table.Th ta="right">Цена</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {preview.preview.map((row) => (
                          <Table.Tr key={row.line}>
                            <Table.Td>{row.name}</Table.Td>
                            <Table.Td>{row.oemNumber || "—"}</Table.Td>
                            <Table.Td>{PART_TYPE_LABELS[row.partType] || row.partType}</Table.Td>
                            <Table.Td>
                              {row.supplyMode === "STOCK"
                                ? <Badge size="xs" variant="light" color="teal">В наличии</Badge>
                                : <Badge size="xs" variant="light" color="orange">
                                    {row.leadTimeDaysMin ? `Под заказ ${row.leadTimeDaysMin}–${row.leadTimeDaysMax || row.leadTimeDaysMin} дн` : "Под заказ"}
                                  </Badge>}
                            </Table.Td>
                            <Table.Td ta="right">{row.price.toLocaleString("ru-RU")} ₽</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                    {preview.readyRows > preview.preview.length && (
                      <Text size="xs" c="dimmed" mt={6}>
                        Показаны первые {preview.preview.length} позиций из {preview.readyRows}.
                      </Text>
                    )}
                  </Box>
                )}

                {preview.errors.length > 0 && (
                  <>
                    <Divider my="sm" />
                    <Text fw={700} size="sm" mb={6}>Отклонённые строки</Text>
                    <Stack gap={4}>
                      {preview.errors.map((item, index) => (
                        <Text key={`${item.line}-${index}`} size="xs" c="dimmed">
                          {item.line > 0 ? `Строка ${item.line}: ` : ""}{item.reason}
                        </Text>
                      ))}
                    </Stack>
                  </>
                )}
              </Card>
            )}
          </>
        )}
      </Stack>

      <Modal opened={Boolean(revertTarget)} onClose={() => setRevertTarget(null)} title="Откатить загрузку?" centered>
        <Stack gap="sm">
          <Text size="sm">
            Из каталога будут удалены все {revertTarget?.created} позиций этой загрузки. Остальной каталог не затрагивается.
          </Text>
          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setRevertTarget(null)}>Отмена</Button>
            <Button color="red" onClick={revertImport} loading={importState === "applying"} leftSection={<IconTrash size={16} />}>
              Удалить позиции
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  )
}
