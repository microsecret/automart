"use client"
export const dynamic = "force-dynamic"
import { useEffect, useState, useTransition } from "react"
import { useParams } from "next/navigation"
import { Box, Stack, Text, Paper, Group, Button, SimpleGrid, ThemeIcon, Badge, Modal, Divider, Skeleton } from "@mantine/core"
import { IconFlame, IconStar, IconArrowUp, IconCheck, IconCreditCard, IconShieldCheck, IconChartBar } from "@tabler/icons-react"
import useSWR from "swr"
import { notifications } from "@mantine/notifications"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"
import { PROMOTION_TARIFFS } from "@/lib/promotion-tariffs"

type ListingViewsResponse = { views: number }
type PromoteResponse = { checkoutUrl: string }

const PROMO_OPTIONS = [
  { ...PROMOTION_TARIFFS.BOOST, desc: PROMOTION_TARIFFS.BOOST.description, price: PROMOTION_TARIFFS.BOOST.amountRub, days: PROMOTION_TARIFFS.BOOST.durationDays, icon: IconArrowUp, color: "#0891b2", bg: "#ecfeff", features: ["Поднятие в топ выдачи", "Статистика просмотров"] },
  { ...PROMOTION_TARIFFS.PREMIUM, desc: PROMOTION_TARIFFS.PREMIUM.description, price: PROMOTION_TARIFFS.PREMIUM.amountRub, days: PROMOTION_TARIFFS.PREMIUM.durationDays, icon: IconFlame, color: "#ea580c", bg: "var(--market-warning-surface)", features: ["Всё из «Поднятия»", "Бейдж Премиум на карточке", "Выделение цветом"] },
  { ...PROMOTION_TARIFFS.VIP, desc: PROMOTION_TARIFFS.VIP.description, price: PROMOTION_TARIFFS.VIP.amountRub, days: PROMOTION_TARIFFS.VIP.durationDays, icon: IconStar, color: "#7c3aed", bg: "#f5f3ff", features: ["Всё из «Премиум»", "Закрепление на главной", "Максимальный приоритет", "Бейдж VIP"] },
]

export default function PromotePage() {
  const { id } = useParams<{ id: string }>()
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
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
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Продвижение объявления</Text>
            <Text size="xs" c="gray.5">Поднимите активное объявление выше в каталоге</Text>
          </Stack>
        </Group>

        {paymentStatus === "success" && (
          <Paper radius="md" p="md" withBorder style={{ background: "var(--market-success-surface)", borderColor: "var(--market-success-line)" }}>
            <Group gap="sm"><IconCheck size={20} color="#059669" /><Text size="sm" c="var(--market-success-text)">Платёж принят. Продвижение включится после подтверждения платёжной системой.</Text></Group>
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
              <Stack gap={0} align="center"><Text fw={700} fz="xl" c="dark.9">{listing.views || 0}</Text><Text size="xs" c="gray.5">просмотров сейчас</Text></Stack>
            </Group>
          </Paper>
        )}

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {PROMO_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <Paper key={opt.id} radius="md" p="md" withBorder style={{ borderColor: selected === opt.id ? opt.color : "#f4f4f5", transition: "border-color 200ms ease, box-shadow 200ms ease, background 200ms ease", cursor: "pointer", position: "relative" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = opt.color; e.currentTarget.style.transform = "translateY(-2px)" }}
                onMouseLeave={(e) => { if (selected !== opt.id) { e.currentTarget.style.borderColor = "#f4f4f5" }; e.currentTarget.style.transform = "" }}>
                {opt.id === "vip" && <Badge pos="absolute" top={-8} right={12} size="xs" color="violet" variant="filled">Выгодно</Badge>}
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Box style={{ width: 44, height: 44, borderRadius: 10, background: opt.bg, display: "flex", alignItems: "center", justifyContent: "center", color: opt.color }}>
                      <Icon size={22} />
                    </Box>
                    <Badge variant="light" color={opt.id === "boost" ? "cyan" : opt.id === "premium" ? "orange" : "violet"} size="xs">{opt.days} дн.</Badge>
                  </Group>
                  <Stack gap={4}>
                    <Text fw={700} fz="md" c="dark.9">{opt.title}</Text>
                    <Text size="xs" c="gray.5" lh={1.4}>{opt.desc}</Text>
                  </Stack>
                  <Stack gap={4}>
                    {opt.features.map((f) => (
                      <Group key={f} gap={6}><IconCheck size={13} color={opt.color} /><Text size="xs" c="gray.6">{f}</Text></Group>
                    ))}
                  </Stack>
                  <Divider my={2} />
                  <Group justify="space-between" align="center">
                    <Text fw={800} fz="xl" c="dark.9" ff="var(--font-display),sans-serif">{opt.price} ₽</Text>
                    <Button size="sm" radius="md" color={opt.id === "boost" ? "cyan" : opt.id === "premium" ? "orange" : "violet"} onClick={() => handleSelect(opt.id)}>Выбрать</Button>
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
                  <Stack gap={2}><Text size="xs" c="gray.5">Тариф</Text><Text fw={600} c="dark.9">{selectedOption.title}</Text></Stack>
                  <Badge size="lg" color={selected === "boost" ? "cyan" : selected === "premium" ? "orange" : "violet"} variant="light">{selectedOption.days} дней</Badge>
                </Group>
                <Divider />
                <Group justify="space-between"><Text size="sm" c="gray.5">Стоимость</Text><Text fw={800} fz="xl" c="dark.9">{selectedOption.price} ₽</Text></Group>
                <Button fullWidth size="md" radius="md" color={selected === "boost" ? "cyan" : selected === "premium" ? "orange" : "violet"} leftSection={<IconCreditCard size={18} />} loading={pending} onClick={handlePay}>
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
