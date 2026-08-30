"use client"

import useSWR from "swr"
import Link from "next/link"
import {
  Anchor, Badge, Box, Button, Card, Container, Divider, Group, Loader, Stack, Text, ThemeIcon, Title,
} from "@mantine/core"
import { IconBuildingStore, IconPhone, IconSearch } from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

type Offer = {
  id: string
  price: number | null
  condition: string | null
  leadTimeDays: number | null
  comment: string | null
  createdAt: string
  store: { id: string; name: string; slug: string; contactPhone: string | null; city: string | null } | null
}

type MyRequest = {
  id: string
  partName: string | null
  oemNumber: string | null
  make: string | null
  model: string | null
  year: number | null
  condition: string
  comment: string | null
  status: string
  createdAt: string
  offers: Offer[]
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  NEW: { label: "Ждёт ответа", color: "orange" },
  IN_PROGRESS: { label: "Есть предложения", color: "teal" },
  DONE: { label: "Закрыта", color: "gray" },
  CANCELLED: { label: "Отменена", color: "gray" },
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
}

/** Срок понятнее словами: «0 дней» человек читает как ошибку. */
function formatLeadTime(days: number | null) {
  if (days === null) return null
  if (days === 0) return "в наличии"
  return `срок ${days} дн.`
}

/**
 * Свои заявки «ищу деталь» и ответы магазинов.
 *
 * Форма обещает: «магазины увидят её и свяжутся с вами». Человек
 * оставлял телефон и уходил ждать — увидеть, ответил ли кто-нибудь и за
 * сколько, было негде: заявка исчезала из его жизни насовсем. Даже
 * уведомление о предложении вело в пустоту.
 *
 * Здесь видно всё, что нужно для решения: цена, срок, состояние и
 * телефон магазина. Дальше человек звонит сам — площадка в разговоре не
 * участвует.
 */
export default function MyPartRequestsPage() {
  const { data, error, isLoading, mutate } = useSWR<{ requests: MyRequest[] }>(
    "/api/parts/requests/mine",
    fetchJson,
    { revalidateOnFocus: true },
  )

  const requests = data?.requests || []

  return (
    <Container size="md" py="lg">
      <Group gap="sm" mb="xs">
        <ThemeIcon variant="light" color="indigo" size={38} radius="md"><IconSearch size={19} /></ThemeIcon>
        <Box>
          <Title order={2} size="h3">Мои заявки на запчасти</Title>
          <Text size="sm" c="dimmed">Что вы искали и что ответили магазины</Text>
        </Box>
      </Group>

      {isLoading ? (
        <Group justify="center" py="xl"><Loader /></Group>
      ) : error ? (
        <AsyncErrorState title="Не удалось загрузить заявки" onRetry={() => void mutate()} />
      ) : requests.length === 0 ? (
        <Card withBorder radius="md" p="lg" mt="md">
          <Stack gap="sm" align="flex-start">
            <Text size="sm">
              Вы ещё не оставляли заявок. Если нужной детали нет в каталоге — опишите её,
              и магазины ответят ценой и сроком.
            </Text>
            <Button component={Link} href="/parts" variant="light" color="indigo">
              Найти запчасть
            </Button>
          </Stack>
        </Card>
      ) : (
        <Stack gap="md" mt="md">
          {requests.map((request) => {
            const status = STATUS_META[request.status] || STATUS_META.NEW
            const vehicle = [request.make, request.model, request.year].filter(Boolean).join(" ")
            return (
              <Card key={request.id} withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Group gap={6} wrap="wrap">
                      <Text fw={700}>{request.partName || "Деталь без названия"}</Text>
                      {request.oemNumber && <Badge size="sm" variant="light" color="teal">{request.oemNumber}</Badge>}
                    </Group>
                    {vehicle && <Text size="sm" c="dimmed">{vehicle}</Text>}
                    <Text size="xs" c="dimmed" mt={4}>Заявка от {formatDate(request.createdAt)}</Text>
                  </Box>
                  <Badge variant="light" color={status.color}>{status.label}</Badge>
                </Group>

                {request.offers.length === 0 ? (
                  <Text size="sm" c="dimmed" mt="sm">
                    Пока никто не ответил. Магазины смотрят заявки в течение дня.
                  </Text>
                ) : (
                  <>
                    <Divider my="sm" label={`Предложений: ${request.offers.length}`} labelPosition="left" />
                    <Stack gap="xs">
                      {request.offers.map((offer) => {
                        const lead = formatLeadTime(offer.leadTimeDays)
                        return (
                          <Card key={offer.id} withBorder radius="sm" p="sm" bg="var(--mantine-color-gray-0)">
                            <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
                              <Box style={{ minWidth: 0, flex: 1 }}>
                                <Group gap={6} wrap="wrap">
                                  <IconBuildingStore size={15} />
                                  {offer.store ? (
                                    <Anchor component={Link} href={`/parts/stores/${offer.store.slug}`} fw={600} size="sm">
                                      {offer.store.name}
                                    </Anchor>
                                  ) : (
                                    <Text fw={600} size="sm">Магазин</Text>
                                  )}
                                  {offer.condition && (
                                    <Badge size="xs" variant="outline" color="gray">
                                      {offer.condition === "NEW" ? "новая" : "б/у"}
                                    </Badge>
                                  )}
                                </Group>
                                {offer.comment && <Text size="sm" mt={4}>{offer.comment}</Text>}
                                <Text size="xs" c="dimmed" mt={4}>
                                  {[offer.store?.city, lead].filter(Boolean).join(" · ")}
                                </Text>
                              </Box>
                              <Stack gap={6} align="flex-end">
                                {offer.price !== null && (
                                  <Text fw={700} size="lg">{offer.price.toLocaleString("ru-RU")} ₽</Text>
                                )}
                                {/* Телефон кнопкой: с телефона это один тап
                                    до разговора, ради которого заявка и
                                    оставлялась. */}
                                {offer.store?.contactPhone && (
                                  <Button
                                    component="a"
                                    href={`tel:${offer.store.contactPhone.replace(/[^\d+]/g, "")}`}
                                    size="compact-sm"
                                    variant="light"
                                    color="teal"
                                    leftSection={<IconPhone size={14} />}
                                  >
                                    Позвонить
                                  </Button>
                                )}
                              </Stack>
                            </Group>
                          </Card>
                        )
                      })}
                    </Stack>
                  </>
                )}
              </Card>
            )
          })}
        </Stack>
      )}
    </Container>
  )
}
