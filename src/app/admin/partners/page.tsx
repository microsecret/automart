"use client"

export const dynamic = "force-dynamic"

import useSWR from "swr"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { Alert, Badge, Box, Button, Card, Center, Divider, Group, Loader, Modal, Paper, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, ThemeIcon, Title, Tooltip } from "@mantine/core"
import type { MantineColor } from "@mantine/core"
import { IconBuildingWarehouse, IconCheck, IconClipboardCheck, IconClock, IconFileSearch, IconMail, IconMessageCircle, IconRefresh, IconShieldCheck, IconX } from "@tabler/icons-react"
import Link from "next/link"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { describePartnerRating } from "@/lib/partner-sla"

const STATUS_META: Record<string, { label: string; color: MantineColor; icon: typeof IconClock }> = {
  PENDING: { label: "Ожидает проверки", color: "orange", icon: IconClock },
  VERIFIED: { label: "Проверен", color: "teal", icon: IconShieldCheck },
  REJECTED: { label: "Отклонён", color: "red", icon: IconX },
  SUSPENDED: { label: "Приостановлен", color: "gray", icon: IconFileSearch },
}

const SOURCE_OPTIONS = [
  { value: "MANUAL", label: "Ручная проверка" },
  { value: "FNS", label: "Проверка по ФНС" },
  { value: "PARTNER", label: "Подтверждение партнёра" },
]

type DeliveryOrganization = {
  id: string
  legalName: string
  inn: string
  ogrn: string | null
  organizationType: string
  serviceRegions: string | null
  verificationStatus: string
  verificationSource: string | null
  fnsCheckedAt: string | null
  verificationNote: string | null
  slaResponseMinutes: number | null
  slaAcceptedOffers: number
  slaMissedOffers: number
  slaClosedDeals: number
  slaRating: number
  slaUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  owner: { id: string; name: string | null; email: string | null; telegramUsername: string | null }
}

type OrganizationsResponse = {
  organizations: DeliveryOrganization[]
  summary: Record<string, number>
}

function organizationKindLabel(value: string) {
  const labels: Record<string, string> = { COMPANY: "Компания", ENTREPRENEUR: "ИП", BROKER: "Брокер", LOGISTICS: "Логистика" }
  return labels[value] || value
}

function sourceLabel(value: string | null) {
  return SOURCE_OPTIONS.find((option) => option.value === value)?.label || "Не указан"
}

function formatRegions(value: string | null) {
  if (!value) return "Регионы не указаны"
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) {
      const regions = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
      return regions.length ? regions.join(", ") : "Регионы не указаны"
    }
  } catch {
    // Legacy records may store a plain text value; show it as-is.
  }
  return value
}

export default function AdminPartnersPage() {
  const [status, setStatus] = useState("PENDING")
  const [editingOrganization, setEditingOrganization] = useState<DeliveryOrganization | null>(null)
  const [nextStatus, setNextStatus] = useState("PENDING")
  const [source, setSource] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const { data, error, isLoading, mutate } = useSWR<OrganizationsResponse>(`/api/admin/delivery-organizations?status=${status}`, fetchJson)

  const openEditor = (organization: DeliveryOrganization) => {
    setEditingOrganization(organization)
    setNextStatus(organization.verificationStatus)
    setSource(organization.verificationSource)
    setNote(organization.verificationNote || "")
    setSaveError("")
  }

  const saveDecision = async () => {
    if (!editingOrganization) return
    setIsSaving(true)
    setSaveError("")
    try {
      await fetchJson<{ organization: DeliveryOrganization }>("/api/admin/delivery-organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingOrganization.id, verificationStatus: nextStatus, verificationSource: source, verificationNote: note }),
      })
      setEditingOrganization(null)
      await mutate()
      notifications.show({ title: "Решение сохранено", message: "Статус и комментарий доступны сотрудникам в рабочем реестре.", color: "teal" })
    } catch (saveDecisionError) {
      setSaveError(getApiClientErrorMessage(saveDecisionError, "Не удалось сохранить решение."))
    } finally {
      setIsSaving(false)
    }
  }

  const summary = data?.summary || {}
  const organizations = data?.organizations || []

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Card className="admin-workspace__hero" radius="md" p={{ base: "md", sm: "lg" }}>
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="white" color="dark" size={46} radius="md"><IconBuildingWarehouse size={23} /></ThemeIcon>
              <Stack gap={3}>
                <Group gap={7}>
                  <Badge variant="white" color="indigo" size="sm">РЕЕСТР ПАРТНЁРОВ</Badge>
                  <Badge variant="dot" color="teal" size="sm">Реальные записи</Badge>
                </Group>
                <Title order={1} size="h3" c="white" ff="var(--font-display),sans-serif">Проверка партнёров по доставке</Title>
                <Text size="sm" c="rgba(255,255,255,.74)">Реквизиты, источник верификации и решение администратора — в одной очереди.</Text>
              </Stack>
            </Group>
            <Group gap="xs">
              <Tooltip label="Обновить реестр"><Button variant="white" color="dark" size="sm" leftSection={<IconRefresh size={15} />} onClick={() => void mutate()}>Обновить</Button></Tooltip>
              <Button component={Link} href="/admin" variant="outline" color="gray" size="sm" styles={{ root: { color: "white", borderColor: "rgba(255,255,255,.48)" } }}>Админка</Button>
            </Group>
          </Group>
        </Card>

        <SegmentedControl
          aria-label="Статус партнёров"
          fullWidth
          color="indigo"
          value={status}
          onChange={setStatus}
          data={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: `${meta.label} · ${summary[value] || 0}` }))}
        />

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {Object.entries(STATUS_META).map(([value, meta]) => {
            const StatusIcon = meta.icon
            return (
              <Paper key={value} withBorder radius="md" p="sm">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color={meta.color} size={36} radius="md"><StatusIcon size={18} /></ThemeIcon>
                  <Stack gap={0}>
                    <Text fw={800} fz="lg" lh={1}>{summary[value] || 0}</Text>
                    <Text size="xs" c="dimmed">{meta.label}</Text>
                  </Stack>
                </Group>
              </Paper>
            )
          })}
        </SimpleGrid>

        {isLoading ? <Center py={80}><Loader color="indigo" /></Center> : error ? (
          <AsyncErrorState title="Не удалось загрузить реестр" description="Данные не изменены. Повторите запрос, когда соединение восстановится." onRetry={() => void mutate()} backHref="/admin" backLabel="В админку" />
        ) : organizations.length === 0 ? (
          <Paper withBorder radius="md" p="xl">
            <Center><Stack align="center" gap="sm"><ThemeIcon size={46} radius="xl" color="teal" variant="light"><IconClipboardCheck size={22} /></ThemeIcon><Text fw={700}>В этой очереди нет партнёров</Text><Text size="sm" c="dimmed" ta="center">Это реальное состояние реестра: тестовые компании не подставляются.</Text></Stack></Center>
          </Paper>
        ) : (
          <Stack gap="sm">
            {organizations.map((organization) => {
              const meta = STATUS_META[organization.verificationStatus] || STATUS_META.PENDING
              const StatusIcon = meta.icon
              return (
                <Paper key={organization.id} withBorder radius="md" p={{ base: "sm", sm: "md" }}>
                  <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                    <Group gap="sm" align="flex-start" wrap="nowrap" style={{ flex: 1, minWidth: 260 }}>
                      <ThemeIcon variant="light" color={meta.color} size={42} radius="md"><StatusIcon size={20} /></ThemeIcon>
                      <Stack gap={4} style={{ minWidth: 0 }}>
                        <Group gap="xs" wrap="wrap">
                          <Text fw={800}>{organization.legalName}</Text>
                          <Badge variant="light" color={meta.color}>{meta.label}</Badge>
                          <Badge variant="outline" color="gray">{organizationKindLabel(organization.organizationType)}</Badge>
                        </Group>
                        <Text size="xs" c="dimmed">ИНН {organization.inn}{organization.ogrn ? ` · ОГРН ${organization.ogrn}` : ""}</Text>
                        <Text size="sm">{formatRegions(organization.serviceRegions)}</Text>
                        {(() => {
                          // Показатели объясняют, почему партнёр получает или
                          // не получает заявки: без них решение о проверке
                          // опирается только на реквизиты.
                          const hasHistory = organization.slaAcceptedOffers + organization.slaMissedOffers > 0 || organization.slaClosedDeals > 0
                          const level = describePartnerRating(organization.slaRating, hasHistory)
                          return (
                            <Group gap={5} wrap="wrap" mt={2}>
                              <Badge size="xs" variant="light" color={level.color}>{level.label}</Badge>
                              {hasHistory && <Badge size="xs" variant="outline" color="gray">Рейтинг {organization.slaRating}/100</Badge>}
                              {organization.slaResponseMinutes !== null && (
                                <Badge size="xs" variant="outline" color="gray">
                                  Ответ ≈ {organization.slaResponseMinutes < 60 ? `${organization.slaResponseMinutes} мин` : `${Math.round(organization.slaResponseMinutes / 60)} ч`}
                                </Badge>
                              )}
                              {hasHistory && <Badge size="xs" variant="outline" color="gray">Принято {organization.slaAcceptedOffers} · пропущено {organization.slaMissedOffers}</Badge>}
                              {organization.slaClosedDeals > 0 && <Badge size="xs" variant="light" color="teal">Сделок: {organization.slaClosedDeals}</Badge>}
                            </Group>
                          )
                        })()}
                      </Stack>
                    </Group>
                    <Stack gap={4} miw={{ base: 0, sm: 240 }}>
                      <Group gap={5}><IconMail size={14} /><Text size="xs">{organization.owner.email || "Email владельца не указан"}</Text></Group>
                      {organization.owner.telegramUsername && <Group gap={5}><IconMessageCircle size={14} /><Text size="xs">@{organization.owner.telegramUsername}</Text></Group>}
                      <Text size="xs" c="dimmed">Источник: {sourceLabel(organization.verificationSource)}{organization.fnsCheckedAt ? ` · ФНС: ${new Date(organization.fnsCheckedAt).toLocaleDateString("ru-RU")}` : ""}</Text>
                    </Stack>
                    <Button size="sm" color="indigo" variant={organization.verificationStatus === "PENDING" ? "filled" : "light"} leftSection={<IconCheck size={15} />} onClick={() => openEditor(organization)}>Проверить</Button>
                  </Group>
                  {organization.verificationNote && <><Divider my="sm" /><Text size="sm" c="dimmed">Решение: {organization.verificationNote}</Text></>}
                </Paper>
              )
            })}
          </Stack>
        )}
      </Stack>

      <Modal opened={Boolean(editingOrganization)} onClose={() => !isSaving && setEditingOrganization(null)} title="Решение по партнёру" centered radius="lg" size="lg">
        <Stack gap="sm">
          <Paper withBorder radius="md" p="sm" bg="gray.0">
            <Text fw={700}>{editingOrganization?.legalName}</Text>
            <Text size="xs" c="dimmed">ИНН {editingOrganization?.inn} · {organizationKindLabel(editingOrganization?.organizationType || "")}</Text>
          </Paper>
          <Alert color="blue" icon={<IconFileSearch size={16} />}>Сверьте реквизиты по подтверждённому источнику. Статус не заменяет юридическую экспертизу и не создаёт платёжных обязательств.</Alert>
          <Select label="Статус проверки" data={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))} value={nextStatus} onChange={(value) => setNextStatus(value || "PENDING")} allowDeselect={false} />
          <Select label="Источник проверки" placeholder="Выберите источник" data={SOURCE_OPTIONS} value={source} onChange={setSource} clearable />
          <Textarea label="Комментарий сотрудника" description="До 1000 символов. Не указывайте пароли, платёжные реквизиты или лишние персональные данные." value={note} onChange={(event) => setNote(event.currentTarget.value)} maxLength={1000} minRows={4} autosize />
          {saveError && <Alert color="red" title="Решение не сохранено">{saveError}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditingOrganization(null)} disabled={isSaving}>Отмена</Button>
            <Button color="indigo" leftSection={<IconCheck size={16} />} onClick={() => void saveDecision()} loading={isSaving}>Сохранить решение</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
