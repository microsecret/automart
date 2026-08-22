"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { notifications } from "@mantine/notifications"
import { Badge, Button, Card, Center, Group, Loader, SegmentedControl, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconAlertTriangle, IconCheck, IconFlag, IconGavel, IconX } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"

const STATUS_META: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Новая", color: "red" },
  IN_REVIEW: { label: "В работе", color: "orange" },
  RESOLVED: { label: "Решена", color: "green" },
  DISMISSED: { label: "Отклонена", color: "gray" },
}

const REASON_LABELS: Record<string, string> = {
  MISLEADING: "Недостоверная информация",
  FRAUD: "Подозрение на мошенничество",
  PROHIBITED: "Запрещённый контент",
  DUPLICATE: "Повторное объявление",
  OTHER: "Другая причина",
}

type ListingReport = {
  id: string
  reason: string
  comment: string | null
  status: string
  createdAt: string
  listingId: string
  listingTitle: string
  listingStatus: string
  vehicleId: string | null
  partId: string | null
  reporterName: string | null
  reporterEmail: string | null
  reviewerName: string | null
}

type ReportsResponse = { reports: ListingReport[] }

const fetchReports = (url: string) => fetchJson<ReportsResponse>(url)

/** Keeps report handling adjacent to listing moderation without duplicating listing controls. */
export default function ListingReportModerationPanel() {
  const { data, error, isLoading, mutate } = useSWR<ReportsResponse>("/api/admin/reports", fetchReports)
  const [view, setView] = useState<"open" | "all">("open")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const reports = data?.reports || []
  const openReports = reports.filter((report) => report.status === "OPEN" || report.status === "IN_REVIEW")
  const displayedReports = view === "open" ? openReports : reports

  const updateStatus = async (id: string, status: "IN_REVIEW" | "RESOLVED" | "DISMISSED") => {
    setUpdatingId(id)
    try {
      await fetchJson<{ id: string; status: string }>("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      notifications.show({
        title: "Статус сохранён",
        message: status === "IN_REVIEW"
          ? "Жалоба взята в работу. Заявитель получит уведомление после решения."
          : "Жалоба рассмотрена, заявитель получил уведомление.",
        color: "green",
      })
      await mutate()
    } catch (updateError) {
      notifications.show({ title: "Не удалось обновить жалобу", message: updateError instanceof Error ? updateError.message : "Повторите попытку", color: "red" })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Card className="admin-moderation-panel" withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="sm"><ThemeIcon variant="light" color="orange" size={32} radius="md"><IconFlag size={18} /></ThemeIcon><Text fw={700} c="var(--market-ink)">Жалобы пользователей</Text></Group>
          <Badge size="sm" variant="light" color={openReports.length ? "orange" : "green"}>{openReports.length} требуют внимания</Badge>
        </Group>
        <Text size="xs" c="dimmed">Решение по жалобе не меняет объявление автоматически: сначала проверьте карточку и затем используйте очередь модерации.</Text>
        <SegmentedControl
          size="xs"
          value={view}
          onChange={(value) => setView(value as "open" | "all")}
          data={[{ label: `Открытые (${openReports.length})`, value: "open" }, { label: `Все (${reports.length})`, value: "all" }]}
        />
        {isLoading ? <Center py={20}><Loader size="sm" color="indigo" /></Center> : error ? (
          <Center py="xl"><Stack align="center" gap="xs"><ThemeIcon variant="light" color="red" size={42} radius="xl"><IconAlertTriangle size={22} /></ThemeIcon><Text fw={600}>Не удалось загрузить жалобы</Text><Button size="xs" variant="light" color="indigo" onClick={() => void mutate()}>Повторить</Button></Stack></Center>
        ) : displayedReports.length === 0 ? (
          <Center py="xl"><Stack align="center" gap={4}><ThemeIcon variant="light" color="green" size={42} radius="xl"><IconCheck size={22} /></ThemeIcon><Text fw={600}>{view === "open" ? "Открытых жалоб нет" : "Жалоб пока нет"}</Text><Text size="sm" c="dimmed">Новые обращения из карточек объявлений появятся здесь.</Text></Stack></Center>
        ) : (
          <Stack gap="xs" mah={520} style={{ overflow: "auto" }}>
            {displayedReports.map((report) => {
              const meta = STATUS_META[report.status] || STATUS_META.OPEN
              const detailHref = report.vehicleId
                ? `/listings/vehicle/${report.vehicleId}`
                : report.partId
                  ? `/listings/part/${report.partId}`
                  : null
              return (
                <Card key={report.id} withBorder radius="md" p="sm" className="moderation-listing-row">
                  <Stack gap="xs">
                    <Group justify="space-between" gap="sm" wrap="wrap">
                      <Group gap={6} wrap="wrap"><Badge size="xs" color={meta.color} variant="light">{meta.label}</Badge><Text size="xs" c="gray.5">{REASON_LABELS[report.reason] || report.reason}</Text></Group>
                      <Text size="xs" c="gray.5">{new Date(report.createdAt).toLocaleString("ru-RU")}</Text>
                    </Group>
                    <Group justify="space-between" gap="sm" align="flex-start" wrap="wrap">
                      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={600} c="var(--market-ink)" className="line-clamp-1">{report.listingTitle}</Text>
                        <Text size="xs" c="gray.5">Заявитель: {report.reporterName || report.reporterEmail || "пользователь"}</Text>
                        {report.comment && <Text size="sm" c="gray.7">{report.comment}</Text>}
                      </Stack>
                      <Group gap="xs" wrap="wrap" justify="flex-end">
                        {detailHref && <Button component={Link} href={detailHref} target="_blank" size="xs" variant="light" color="indigo">Открыть карточку</Button>}
                        {report.status === "OPEN" && <Button size="xs" variant="light" color="orange" loading={updatingId === report.id} onClick={() => void updateStatus(report.id, "IN_REVIEW")} leftSection={<IconGavel size={12} />}>В работу</Button>}
                        {(report.status === "OPEN" || report.status === "IN_REVIEW") && <Button size="xs" variant="light" color="green" loading={updatingId === report.id} onClick={() => void updateStatus(report.id, "RESOLVED")} leftSection={<IconCheck size={12} />}>Решена</Button>}
                        {(report.status === "OPEN" || report.status === "IN_REVIEW") && <Button size="xs" variant="subtle" color="gray" loading={updatingId === report.id} onClick={() => void updateStatus(report.id, "DISMISSED")} leftSection={<IconX size={12} />}>Отклонить</Button>}
                      </Group>
                    </Group>
                  </Stack>
                </Card>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
