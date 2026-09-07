"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Pagination,
  Anchor, Badge, Box, Button, Card, Center, Container, Group, Loader,
  SegmentedControl, Stack, Text, Title,
} from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconFlag } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { reportReasonLabel } from "@/lib/forum-reports"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"
import { stripForumMarkup } from "@/lib/forum-markup"

/**
 * Очередь жалоб на сообщения форума.
 *
 * Без разбора жалобы бесполезны: человек нажимает «пожаловаться», ничего
 * не происходит, и в следующий раз он просто уходит.
 */

type Report = {
  id: string
  reason: string
  comment: string | null
  createdAt: string
  resolvedAt: string | null
  author: { name: string | null }
  post: {
    id: string
    content: string
    deletedAt: string | null
    createdAt: string
    author: { id: string; name: string | null }
    topic: { title: string; slug: string; section: { slug: string } }
  }
}

type Response = { reports: Report[]; total: number; pending: number; pages: number }

export default function AdminForumPage() {
  const [tab, setTab] = useState("pending")
  const [busy, setBusy] = useState<string | null>(null)
  /* Страница жалоб.

     Сервер отдаёт по тридцать жалоб за раз и сообщает общее число страниц,
     но интерфейс это число не читал: модератор видел только первую
     страницу, а остальная очередь была физически недостижима. При
     спам-волне это значит, что часть жалоб никто никогда не разберёт. */
  const [page, setPage] = useState(1)

  const { data, error, isLoading, mutate } = useSWR<Response>(
    `/api/admin/forum-reports?resolved=${tab === "resolved"}&page=${page}`,
    fetchJson,
  )

  const act = async (reportId: string, action: string, successText: string) => {
    /* Удаление сообщения спрашивают отдельно: остальные действия по
       жалобе обратимы, а это — нет. Кнопки стоят в ряд, и промах стоил бы
       чужого текста без возможности вернуть. */
    if (action === "delete-post" && !window.confirm("Удалить сообщение? Восстановить его будет нельзя.")) return

    setBusy(reportId)
    try {
      await fetchJson("/api/admin/forum-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action }),
      })
      await mutate()
      notifications.show({ title: successText, message: "", color: "teal" })
    } catch (actionError) {
      notifications.show({
        title: "Не получилось",
        message: actionError instanceof Error ? actionError.message : "Повторите попытку",
        color: "red",
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Container size="lg" py="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
          <Box>
            <Title order={1} fz={{ base: 20, md: 26 }} c="var(--market-ink)">Жалобы на форуме</Title>
            <Text size="sm" c="var(--market-muted)" mt={2}>
              Спам и грубость убирают отсюда. Удаление мягкое: на месте сообщения остаётся пометка.
            </Text>
          </Box>

          {/* Счётчик неразобранных в заголовке: по нему видно, есть ли
              работа, не открывая вкладку. */}
          {data && data.pending > 0 && (
            <Badge size="lg" color="red" variant="light" leftSection={<IconFlag size={13} />}>
              {data.pending} без разбора
            </Badge>
          )}
        </Group>

        <SegmentedControl
          value={tab}
          /* Со сменой вкладки возвращаемся к началу: иначе на «Разобранных»
             открывалась пятая страница, которой там может не быть. */
          onChange={(value) => { setTab(value); setPage(1) }}
          data={[
            { value: "pending", label: "Без разбора" },
            { value: "resolved", label: "Разобранные" },
          ]}
        />

        {isLoading && <Center py="xl"><Loader /></Center>}

        {error && (
          <Card withBorder radius="md" p="md">
            <Text size="sm" c="var(--market-danger-text)">Не удалось загрузить очередь. Обновите страницу.</Text>
          </Card>
        )}

        {data && data.reports.length === 0 && (
          <Card withBorder radius="md" p="xl">
            <Stack align="center" gap={4} ta="center">
              <Text fw={700} c="var(--market-ink)">
                {tab === "pending" ? "Жалоб нет" : "Разобранных пока нет"}
              </Text>
              <Text size="sm" c="var(--market-muted)">
                {tab === "pending" ? "Всё разобрано." : "Здесь будет история разбора."}
              </Text>
            </Stack>
          </Card>
        )}

        {data?.reports.map((report) => (
          <Card key={report.id} withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Group gap={8} wrap="wrap">
                <Badge size="sm" color="red" variant="light">{reportReasonLabel(report.reason)}</Badge>
                <Text fz="xs" c="var(--market-muted)">
                  от {report.author.name || "участника"} · {formatAdminDateTimeShort(new Date(report.createdAt))}
                </Text>
                {report.post.deletedAt && (
                  <Badge size="xs" color="gray" variant="light">сообщение удалено</Badge>
                )}
                {report.resolvedAt && (
                  <Badge size="xs" color="teal" variant="light">разобрана</Badge>
                )}
              </Group>

              {report.comment && (
                <Text size="sm" c="var(--market-ink)">«{report.comment}»</Text>
              )}

              <Card withBorder radius="sm" p="xs" bg="var(--market-surface-subtle)">
                <Group gap={6} wrap="wrap" mb={4}>
                  <Text fz="xs" fw={600} c="var(--market-ink)">
                    {report.post.author.name || "Участник"}
                  </Text>
                  <Text fz="xs" c="var(--market-muted)">
                    {formatAdminDateTimeShort(new Date(report.post.createdAt))}
                  </Text>
                  <Anchor
                    component={Link}
                    href={`/forum/${report.post.topic.section.slug}/${report.post.topic.slug}#post-${report.post.id}`}
                    target="_blank"
                    fz="xs"
                  >
                    {report.post.topic.title}
                  </Anchor>
                </Group>
                {/* Текст без разметки: модератору нужно содержание, а
                    картинки и таблицы в очереди только мешают. */}
                <Text size="sm" c="var(--market-ink)" lineClamp={6}>
                  {stripForumMarkup(report.post.content)}
                </Text>
              </Card>

              <Group gap="xs">
                {!report.post.deletedAt ? (
                  <Button
                    size="compact-sm"
                    color="red"
                    variant="light"
                    loading={busy === report.id}
                    onClick={() => void act(report.id, "delete-post", "Сообщение удалено")}
                  >
                    Удалить сообщение
                  </Button>
                ) : (
                  <Button
                    size="compact-sm"
                    color="gray"
                    variant="light"
                    loading={busy === report.id}
                    onClick={() => void act(report.id, "restore-post", "Сообщение возвращено")}
                  >
                    Вернуть сообщение
                  </Button>
                )}

                {!report.resolvedAt ? (
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    color="gray"
                    loading={busy === report.id}
                    onClick={() => void act(report.id, "resolve", "Жалоба разобрана")}
                  >
                    Всё в порядке
                  </Button>
                ) : (
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    color="gray"
                    loading={busy === report.id}
                    onClick={() => void act(report.id, "reopen", "Жалоба возвращена в очередь")}
                  >
                    Вернуть в очередь
                  </Button>
                )}
              </Group>
            </Stack>
          </Card>
        ))}

        {/* Навигация появляется, только когда страниц больше одной: при
            десятке жалоб пустая полоса внизу читалась бы как недогруженное. */}
        {(data?.pages ?? 1) > 1 && (
          <Group justify="center" mt="sm">
            <Pagination
              total={data?.pages ?? 1}
              value={page}
              onChange={setPage}
              size="sm"
              radius="md"
            />
          </Group>
        )}
      </Stack>
    </Container>
  )
}
