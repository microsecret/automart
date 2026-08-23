"use client"

import Link from "next/link"
import useSWR from "swr"
import { Badge, Box, Button, Center, Group, Paper, Skeleton, Stack, Text, ThemeIcon, Title } from "@mantine/core"
import { IconDownload, IconFileDescription, IconFolderOpen, IconTruckDelivery } from "@tabler/icons-react"
import DashboardNav from "@/components/dashboard/DashboardNav"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

type DeliveryDocument = {
  id: string
  title: string
  category: string
  fileName: string
  mimeType: string
  size: number
  createdAt: string
  downloadUrl: string
  deliveryOrder: { id: string; code: string; title: string; status: string }
}

type DocumentsResponse = { documents: DeliveryDocument[] }

const CATEGORY_LABELS: Record<string, string> = {
  INVOICE: "Счёт",
  RECEIPT: "Квитанция",
  EXPORT: "Экспорт",
  CUSTOMS: "Таможня",
  LABORATORY: "Лаборатория",
  EPTS: "ЭПТС",
  CONTRACT: "Договор",
  OTHER: "Документ",
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} КБ`
  return `${(value / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`
}

export default function DashboardDocumentsPage() {
  const { data, error, isLoading, mutate } = useSWR<DocumentsResponse>("/api/delivery-documents", fetchJson)
  const documents = data?.documents || []

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={3}>
            <Title order={1} size="h2">Мои документы</Title>
            <Text c="dimmed">Счета, договоры, квитанции и файлы по вашим доставкам в одном месте.</Text>
          </Stack>
          <Button component={Link} href="/dashboard/deliveries" variant="light" color="indigo" leftSection={<IconTruckDelivery size={16} />}>Открыть доставки</Button>
        </Group>

        <DashboardNav active="documents" />

        {isLoading ? (
          <Stack gap="xs">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={76} radius="md" />)}</Stack>
        ) : error ? (
          <AsyncErrorState title="Не удалось загрузить документы" description="Файлы временно недоступны. Повторите запрос." onRetry={() => mutate()} />
        ) : documents.length === 0 ? (
          <Paper withBorder radius="md" p="xl">
            <Center py={48}>
              <Stack align="center" gap="sm" maw={440} ta="center">
                <ThemeIcon size={58} radius="xl" variant="light" color="indigo"><IconFolderOpen size={28} /></ThemeIcon>
                <Text fw={800} fz="lg">Документов пока нет</Text>
                <Text size="sm" c="dimmed">После открытия доставки здесь появятся договоры, счета, квитанции и документы оформления. Доступ получают только участники сделки.</Text>
                <Button component={Link} href="/dashboard/deliveries" color="indigo">Перейти к доставкам</Button>
              </Stack>
            </Center>
          </Paper>
        ) : (
          <Stack gap="xs">
            {documents.map((document) => (
              <Paper key={document.id} withBorder radius="md" p="md" className="dashboard-document-row">
                <Group justify="space-between" gap="md" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <ThemeIcon size={42} radius="md" variant="light" color="indigo"><IconFileDescription size={21} /></ThemeIcon>
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={700} lineClamp={1}>{document.title}</Text>
                        <Badge size="xs" variant="light" color="indigo">{CATEGORY_LABELS[document.category] || document.category}</Badge>
                      </Group>
                      <Text component={Link} href={`/dashboard/deliveries/${document.deliveryOrder.id}`} size="xs" c="indigo" lineClamp={1} style={{ textDecoration: "none" }}>
                        {document.deliveryOrder.code} · {document.deliveryOrder.title}
                      </Text>
                      <Text size="xs" c="dimmed">{formatBytes(document.size)} · {new Date(document.createdAt).toLocaleDateString("ru-RU")}</Text>
                    </Stack>
                  </Group>
                  <Button component="a" href={document.downloadUrl} variant="light" color="indigo" size="xs" leftSection={<IconDownload size={14} />}>Скачать</Button>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
