"use client"
export const dynamic = "force-dynamic"
import { useEffect, useState, useTransition } from "react"
import { useParams } from "next/navigation"
import { Box, Stack, Text, Paper, Group, Button, SimpleGrid, ThemeIcon, Badge, Modal, Divider, Skeleton } from "@mantine/core"
import { IconBrandTelegram, IconFlame, IconStar, IconArrowUp, IconCheck, IconCreditCard, IconShieldCheck, IconChartBar } from "@tabler/icons-react"
import useSWR from "swr"
import { notifications } from "@mantine/notifications"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"
import { PROMOTION_TARIFFS } from "@/lib/promotion-tariffs"

type ListingViewsResponse = { views: number }
type PromoteResponse = { checkoutUrl: string }

const PROMO_OPTIONS = [
  /* Показ в чатах стоит первым: он дешевле остальных и даёт охват,
     которого нет у продвижения внутри каталога — сто четырнадцать тысяч
     подписчиков одиннадцати региональных групп. Для продавца это самое
     понятное предложение, и прятать его за более дорогими незачем. */
  {
    ...PROMOTION_TARIFFS.CHATS,
    desc: PROMOTION_TARIFFS.CHATS.description,
    price: PROMOTION_TARIFFS.CHATS.amountRub,
    days: PROMOTION_TARIFFS.CHATS.durationDays,
    icon: IconBrandTelegram,
    color: "#0088cc",
    bg: "#e7f5ff",
    features: [
      "11 чатов сети — 114 000 подписчиков",
      "До 9 фотографий альбомом",
      "Кнопка «Написать продавцу» в посте",
      "Закрепление поста в чате",
    ],
  },
  { ...PROMOTION_TARIFFS.BOOST, desc: PROMOTION_TARIFFS.BOOST.description, price: PROMOTION_TARIFFS.BOOST.amountRub, days: PROMOTION_TARIFFS.BOOST.durationDays, icon: IconArrowUp, color: "#0891b2", bg: "#ecfeff", features: ["Поднятие в топ выдачи", "Статистика просмотров"] },
  { ...PROMOTION_TARIFFS.PREMIUM, desc: PROMOTION_TARIFFS.PREMIUM.description, price: PROMOTION_TARIFFS.PREMIUM.amountRub, days: PROMOTION_TARIFFS.PREMIUM.durationDays, icon: IconFlame, color: "#ea580c", bg: "var(--market-warning-surface)", features: ["Всё из «Поднятия»", "Бейдж Премиум на карточке", "Выделение цветом"] },
  { ...PROMOTION_TARIFFS.VIP, desc: PROMOTION_TARIFFS.VIP.description, price: PROMOTION_TARIFFS.VIP.amountRub, days: PROMOTION_TARIFFS.VIP.durationDays, icon: IconStar, color: "#1c4291", bg: "#f5f3ff", features: ["Всё из «Премиум»", "Закрепление на главной", "Максимальный приоритет", "Бейдж VIP"] },
]

export default function PromotePage() {
  const { id } = useParams<{ id: string }>()
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  /* Что показывать после возвращения из кассы: ждём подтверждения или
     продвижение уже включилось. */
  const [checkState, setCheckState] = useState<"idle" | "checking" | "activated" | "pending">("idle")
  const [selected, setSelected] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const { data: listing, error: listingError, isLoading: isListingLoading, mutate: reloadViews } = useSWR<ListingViewsResponse>(
    id ? `/api/listings/${id}/views` : null,
    fetchJson,
  )

  const selectedOption = PROMO_OPTIONS.find((o) => o.id === selected)

  useEffect(() => {
    setPaymentStatus(new URLSearchParams(window.location.search).get("payment"))
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
          body: JSON.stringify({ listingId: id }),
        })
        const payload = await response.json().catch(() => null)
        if (cancelled) return

        if (payload?.status === "activated" || payload?.status === "unknown") {
          setCheckState("activated")
          void reloadViews()
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
  }, [paymentStatus, id, reloadViews])

  const handleSelect = (id: string) => {
    setSelected(id)
    setModalOpen(true)
  }

  const handlePay = () => {
    startTransition(async () => {
      try {
        const result = await fetchJson<PromoteResponse>(`/api/listings/${id}/promote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tariff: selected }),
        })
        window.location.assign(result.checkoutUrl)
      } catch (e) {
        notifications.show({ title: "Оплата недоступна", message: e instanceof Error ? e.message : "Не удалось открыть безопасную оплату", color: "red" })
      }
    })
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
            <Text size="xs" c="gray.5">Поднимите активное объявление выше в каталоге</Text>
          </Stack>
        </Group>

        {paymentStatus === "success" && (
          <Paper radius="md" p="md" withBorder style={{ background: "var(--market-success-surface)", borderColor: "var(--market-success-line)" }}>
            <Group gap="sm">
              <IconCheck size={20} color="#059669" />
              <Text size="sm" c="var(--market-success-text)">
                {checkState === "activated"
                  ? "Оплата прошла, продвижение включено."
                  : checkState === "checking"
                    ? "Платёж принят, проверяем подтверждение кассы…"
                    : "Платёж принят. Продвижение включится в течение нескольких минут — страницу можно закрыть."}
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
              <Stack gap={0} align="center"><Text fw={700} fz="xl" c="var(--market-ink)">{listing.views || 0}</Text><Text size="xs" c="gray.5">просмотров сейчас</Text></Stack>
            </Group>
          </Paper>
        )}

        {/* Четыре тарифа в сетке из трёх колонок ломали ряд: четвёртый
            падал вниз в одиночку и выглядел довеском, а не равным
            вариантом. Две колонки на среднем экране и четыре на широком
            держат ряд целым при любой ширине. */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {PROMO_OPTIONS.map((opt) => {
            const Icon = opt.icon
            // Выбранный тариф остаётся выделенным цветом тарифа, а наведение отдано
            // CSS: JS-обработчик стирал рамку выбранного варианта, когда курсор уходил
            // с соседней карточки, и пользователь терял из виду, за что платит.
            return (
              <Paper key={opt.id} radius="md" p="md" withBorder className="market-linked-card"
                style={{
                  /* Рекомендованный тариф обведён заметнее остальных даже
                     когда ничего не выбрано: в ряду из четырёх одинаковых
                     карточек взгляду не за что зацепиться. */
                  borderColor: selected === opt.id ? opt.color : opt.id === "premium" ? "var(--market-primary)" : undefined,
                  borderWidth: selected === opt.id || opt.id === "premium" ? 2 : undefined,
                  cursor: "pointer",
                  position: "relative",
                }}>
                {/* Метка стоит на «Премиум», а не на самом дорогом тарифе.

                    «Выгодно» на VIP не помогало выбрать: человек и так видит,
                    что это верх линейки, а подсказка на самом дорогом читается
                    как попытка продать подороже. Отметка нужна на среднем
                    варианте — она снимает вопрос «с чего начать» у того, кто
                    впервые продвигает объявление. */}
                {opt.id === "premium" && (
                  <Badge pos="absolute" top={-9} left="50%" size="sm" color="indigo" variant="filled"
                    style={{ transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                    Выбирают чаще всего
                  </Badge>
                )}
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Box style={{ width: 44, height: 44, borderRadius: 10, background: opt.bg, display: "flex", alignItems: "center", justifyContent: "center", color: opt.color }}>
                      <Icon size={22} />
                    </Box>
                    {/* Срок — служебная величина, а не отличие тарифа: цвет
                        ей ни к чему. Раньше срок раскрашивался в тот же цвет,
                        что и кнопка, и ряд получал восемь цветных пятен. */}
                    <Badge variant="light" color="gray" size="xs">{opt.days} дн.</Badge>
                  </Group>
                  <Stack gap={4}>
                    <Text fw={700} fz="md" c="var(--market-ink)">{opt.title}</Text>
                    <Text size="xs" c="gray.5" lh={1.4}>{opt.desc}</Text>
                  </Stack>
                  <Stack gap={4}>
                    {opt.features.map((f) => (
                      <Group key={f} gap={6}><IconCheck size={13} color={opt.color} /><Text size="xs" c="gray.6">{f}</Text></Group>
                    ))}
                  </Stack>
                  <Divider my={2} />
                  <Group justify="space-between" align="center">
                    <Text fw={800} fz="xl" c="var(--market-ink)" ff="var(--font-display),sans-serif">{opt.price} ₽</Text>
                    {/* Кнопка одна на все тарифы, а не своего цвета у каждого.

                        Четыре разноцветные кнопки в ряду означали четыре
                        разных действия, хотя действие одно — выбрать тариф.
                        Различать варианты должны значок, название и цена, а
                        не цвет кнопки. Выделен только рекомендованный: он
                        залит, остальные обведены. */}
                    <Button
                      size="sm"
                      variant={opt.id === "premium" ? "filled" : "default"}
                      onClick={() => handleSelect(opt.id)}
                    >
                      Выбрать
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            )
          })}
        </SimpleGrid>

        <Paper radius="md" p="md" withBorder style={{ background: "var(--market-success-surface)", borderColor: "var(--market-success-line)" }}>
          <Group gap="sm" align="center">
            <IconShieldCheck size={20} color="#059669" />
            <Text size="xs" c="var(--market-success-text)">Продвижение включается только после подтверждения оплаты платёжной системой.</Text>
          </Group>
        </Paper>
      </Stack>

      {/* Модалка оплаты */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Оплата продвижения" centered size="sm">
          <Stack gap="md">
            {selectedOption && (
              <>
                <Group justify="space-between" align="center">
                  <Stack gap={2}><Text size="xs" c="gray.5">Тариф</Text><Text fw={600} c="var(--market-ink)">{selectedOption.title}</Text></Stack>
                  <Badge size="lg" color={selected === "boost" ? "cyan" : selected === "premium" ? "orange" : "violet"} variant="light">{selectedOption.days} дней</Badge>
                </Group>
                <Divider />
                <Group justify="space-between"><Text size="sm" c="gray.5">Стоимость</Text><Text fw={800} fz="xl" c="var(--market-ink)">{selectedOption.price} ₽</Text></Group>
                <Button fullWidth size="md" color={selected === "boost" ? "cyan" : selected === "premium" ? "orange" : "violet"} leftSection={<IconCreditCard size={18} />} loading={pending} onClick={handlePay}>
                  Оплатить {selectedOption.price} ₽
                </Button>
                <Text size="xs" c="gray.5" ta="center">После нажатия откроется защищённая платёжная страница. Тариф активируется только после подтверждённой оплаты.</Text>
              </>
            )}
          </Stack>
      </Modal>
    </Box>
  )
}
