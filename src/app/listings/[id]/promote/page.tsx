"use client"
export const dynamic = "force-dynamic"
import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Box, Stack, Text, Paper, Group, Button, SimpleGrid, ThemeIcon, Badge, Modal, Divider, Skeleton } from "@mantine/core"
import { IconBrandTelegram, IconCheck, IconCreditCard, IconShieldCheck, IconChartBar } from "@tabler/icons-react"
import useSWR from "swr"
import { notifications } from "@mantine/notifications"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"
import { CHAT_PROMOTION_OPTIONS, PROMOTION_PAYMENT_SUPPORT } from "@/lib/promotion-tariffs"
import { useTelegramSession } from "@/lib/use-telegram-session"

type ListingViewsResponse = { views: number }
type PromoteResponse = { checkoutUrl: string }
const supportUrl = `https://t.me/${PROMOTION_PAYMENT_SUPPORT}`

export default function PromotePage() {
  const { id } = useParams<{ id: string }>()
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const insideMiniApp = useTelegramSession()
  /* Что показывать после возвращения из кассы: ждём подтверждения или
     продвижение уже включилось. */
  const [checkState, setCheckState] = useState<"idle" | "checking" | "activated" | "pending" | "unknown">("idle")
  const [selected, setSelected] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const { data: listing, error: listingError, isLoading: isListingLoading, mutate: reloadViews } = useSWR<ListingViewsResponse>(
    id ? `/api/listings/${id}/views` : null,
    fetchJson,
  )

  const selectedOption = CHAT_PROMOTION_OPTIONS.find((o) => o.id === selected)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    setPaymentStatus(query.get("payment"))
    setOrderId(query.get("order"))
    const option = CHAT_PROMOTION_OPTIONS.find((plan) => plan.id === query.get("tariff"))
    if (option) {
      setSelected(option.id)
      setModalOpen(true)
    }
  }, [])

  /* Проверяем оплату сразу, как человек вернулся.

     Уведомление ЮKassa приходит за секунды, но не всегда: адрес в
     кабинете кассы может быть не указан. Сверка по расписанию догонит
     за пять минут — а человек стоит здесь прямо сейчас и смотрит,
     включилось ли то, за что он заплатил. Пять минут перед
     неизменившимся экраном — это человек, который ушёл и написал в
     поддержку.

     Три попытки с нарастающим ожиданием: касса иногда отвечает
     «в обработке» несколько секунд после списания. */
  useEffect(() => {
    if (paymentStatus !== "success" || !id) return

    let cancelled = false
    const attempt = async (index: number) => {
      if (cancelled || index > 2) return
      setCheckState("checking")
      try {
        const response = await fetch("/api/payment/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ listingId: id, orderId }),
        })
        const payload = await response.json().catch(() => null)
        if (cancelled) return

        if (payload?.status === "activated") {
          setCheckState("activated")
          void reloadViews()
          return
        }
        /* Отменённую оплату показываем отменённой, а не «принятой». */
        if (payload?.status === "canceled") {
          setPaymentStatus("canceled")
          return
        }
        /* Касса не ответила или заказа нет: успехом это не называем. */
        if (payload?.status === "unknown") {
          setCheckState("unknown")
          return
        }

        setCheckState("pending")
        window.setTimeout(() => void attempt(index + 1), (index + 1) * 4000)
      } catch {
        if (!cancelled) setCheckState("pending")
      }
    }

    void attempt(0)
    return () => { cancelled = true }
  }, [paymentStatus, id, orderId, reloadViews])

  const handleSelect = (id: string) => {
    setSelected(id)
    setModalOpen(true)
  }

  const openCheckoutSite = (option: string) => {
    const url = new URL(window.location.pathname, window.location.origin)
    url.searchParams.set("tariff", option)
    const app = window.Telegram?.WebApp
    if (app?.openLink) app.openLink(url.toString())
    else window.open(url.toString(), "_blank", "noopener,noreferrer")
  }

  const handlePay = async () => {
    if (!selectedOption || submitting.current) return
    if (insideMiniApp || window.Telegram?.WebApp?.initData) {
      openCheckoutSite(selectedOption.id)
      return
    }
    submitting.current = true
    setPending(true)
    try {
      const result = await fetchJson<PromoteResponse>(`/api/listings/${id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tariff: selectedOption.id }),
      })
      window.location.assign(result.checkoutUrl)
    } catch (e) {
      submitting.current = false
      setPending(false)
      notifications.show({
        title: "Оплата недоступна", color: "red",
        message: <>{e instanceof Error ? e.message : "Не удалось открыть оплату"}<br /><a href={supportUrl} target="_blank" rel="noreferrer">Написать администратору</a></>,
      })
    }
  }

  if (listingError) {
    return (
      <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 800, margin: "0 auto" }}>
        <AsyncErrorState
          title="Не удалось открыть продвижение"
          description={listingError instanceof Error ? listingError.message : "Проверьте состояние объявления и попробуйте ещё раз."}
          onRetry={() => void reloadViews()}
          backHref="/dashboard"
          backLabel="В кабинет"
        />
      </Box>
    )
  }

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 800, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="violet" size={44} radius="md"><IconChartBar size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" c="var(--market-ink)" ff="var(--font-display),sans-serif">Продвижение объявления</Text>
            <Text size="xs" c="var(--market-muted)">Выберите частоту публикаций в Telegram</Text>
          </Stack>
        </Group>

        {paymentStatus === "success" && (
          <Paper radius="md" p="md" withBorder style={{ background: "var(--market-success-surface)", borderColor: "var(--market-success-line)" }}>
            <Group gap="sm">
              <IconCheck size={20} color="#059669" />
              <Text size="sm" c="var(--market-success-text)">
                {checkState === "activated"
                  ? "Оплата прошла, продвижение включено."
                  : checkState === "unknown"
                    ? "Не видим подтверждения оплаты. Если деньги списаны — напишите в поддержку, проверим вручную."
                  : checkState === "checking"
                    ? "Проверяем подтверждение кассы…"
                    : "Ждём подтверждение кассы. Статус можно проверить в разделе «Оплаты»."}
              </Text>
            </Group>
          </Paper>
        )}
        {paymentStatus === "canceled" && (
          <Paper radius="md" p="md" withBorder style={{ background: "var(--market-warning-surface)", borderColor: "var(--market-warning-line)" }}>
            <Text size="sm" c="var(--market-warning-text)">Оплата отменена. Объявление не продвигалось, средства не списаны.</Text>
          </Paper>
        )}

        {isListingLoading && (
          <Paper radius="md" p="sm" withBorder>
            <Stack align="center" gap={6}><Skeleton height={28} width={52} /><Skeleton height={12} width={116} /></Stack>
          </Paper>
        )}
        {listing?.views !== undefined && (
          <Paper radius="md" p="sm" withBorder style={{ background: "var(--mantine-color-gray-0)" }}>
            <Group gap="md" justify="center">
              <Stack gap={0} align="center"><Text fw={700} fz="xl" c="var(--market-ink)">{listing.views || 0}</Text><Text size="xs" c="var(--market-muted)">просмотров сейчас</Text></Stack>
            </Group>
          </Paper>
        )}

        <Paper radius="md" p="md" withBorder>
          <Stack gap={4}>
            <Text fw={700}>Ваше объявление увидят в городских чатах LeWheel</Text>
            <Text size="sm" c="dimmed">Семь дней показов во всех подключённых чатах. В публикации — до девяти фото, ссылка на объявление и кнопка связи с продавцом.</Text>
          </Stack>
        </Paper>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {CHAT_PROMOTION_OPTIONS.map((option, index) => (
            <Paper key={option.id} radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <ThemeIcon color="teal" variant="light" size={40} radius="md"><IconBrandTelegram size={22} /></ThemeIcon>
                  <Badge color="gray" variant="light">{option.durationDays} дней</Badge>
                </Group>
                <Text fw={700}>{option.title}</Text>
                <Text size="sm" c="dimmed">{option.description}</Text>
                <Text fw={800} fz="xl">{option.amountRub} ₽</Text>
                <Button color="teal" variant={index === 0 ? "filled" : "light"} onClick={() => insideMiniApp || window.Telegram?.WebApp?.initData ? openCheckoutSite(option.id) : handleSelect(option.id)}>
                  {insideMiniApp ? "К оплате на сайте" : "Выбрать"}
                </Button>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>

        <Paper radius="md" p="md" withBorder style={{ background: "var(--market-success-surface)", borderColor: "var(--market-success-line)" }}>
          <Group gap="sm" align="center">
            <IconShieldCheck size={20} color="#059669" />
            <Text size="xs" c="var(--market-success-text)">Продвижение включается только после подтверждения оплаты платёжной системой.</Text>
          </Group>
          <Button component="a" href={supportUrl} target="_blank" rel="noreferrer" size="compact-sm" variant="subtle" color="teal" mt="xs">
            Вопросы по оплате · @{PROMOTION_PAYMENT_SUPPORT}
          </Button>
        </Paper>
      </Stack>

      {/* Модалка оплаты */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Оплата продвижения" centered size="sm">
          <Stack gap="md">
            {selectedOption && (
              <>
                <Group justify="space-between" align="center">
                  <Stack gap={2}><Text size="xs" c="var(--market-muted)">Тариф</Text><Text fw={600} c="var(--market-ink)">{selectedOption.title}</Text></Stack>
                  <Badge size="lg" color="teal" variant="light">{selectedOption.durationDays} дней</Badge>
                </Group>
                <Divider />
                <Group justify="space-between"><Text size="sm" c="var(--market-muted)">Стоимость</Text><Text fw={800} fz="xl" c="var(--market-ink)">{selectedOption.amountRub} ₽</Text></Group>
                <Button fullWidth size="md" color="teal" leftSection={<IconCreditCard size={18} />} loading={pending} onClick={handlePay}>
                  Оплатить {selectedOption.amountRub} ₽
                </Button>
                <Text size="xs" c="var(--market-muted)" ta="center">После нажатия откроется защищённая платёжная страница. Тариф активируется только после подтверждённой оплаты.</Text>
              </>
            )}
          </Stack>
      </Modal>
    </Box>
  )
}
