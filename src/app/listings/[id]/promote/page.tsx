"use client"
export const dynamic = "force-dynamic"
import { useState, useTransition } from "react"
import { useParams } from "next/navigation"
import { Box, Stack, Text, Paper, Group, Button, SimpleGrid, ThemeIcon, Badge, Modal, Center, Loader, Divider, Alert } from "@mantine/core"
import { IconFlame, IconStar, IconArrowUp, IconCheck, IconCreditCard, IconShieldCheck, IconChartBar } from "@tabler/icons-react"
import useSWR from "swr"
import { notifications } from "@mantine/notifications"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const PROMO_OPTIONS = [
  { id: "boost", title: "Поднятие в топ", desc: "Объявление поднимется на первое место в поиске", price: 499, icon: IconArrowUp, color: "#0891b2", bg: "#ecfeff", days: 3, features: ["Поднятие в топ выдачи", "Длительность: 3 дня", "Статистика просмотров"] },
  { id: "premium", title: "Премиум", desc: "Выделение цветом, бейдж «Премиум», приоритет в выдаче", price: 1490, icon: IconFlame, color: "#ea580c", bg: "#fff7ed", days: 7, features: ["Всё из «Поднятия»", "Бейдж Премиум на карточке", "Выделение цветом", "Длительность: 7 дней"] },
  { id: "vip", title: "VIP-размещение", desc: "Закрепление на главной + топ поиска + бейдж VIP", price: 3990, icon: IconStar, color: "#7c3aed", bg: "#f5f3ff", days: 30, features: ["Всё из «Премиум»", "Закрепление на главной", "Максимальный приоритет", "Бейдж VIP", "Длительность: 30 дней"] },
]

export default function PromotePage() {
  const { id } = useParams<{ id: string }>()
  const [selected, setSelected] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [paid, setPaid] = useState(false)
  const [pending, startTransition] = useTransition()
  const { data: listing } = useSWR(`/api/listings/${id}/views`, fetcher)

  const selectedOption = PROMO_OPTIONS.find((o) => o.id === selected)

  const handleSelect = (id: string) => {
    setSelected(id)
    setPaid(false)
    setModalOpen(true)
  }

  const handlePay = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/listings/${id}/promote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tariff: selected }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Ошибка")
        setPaid(true)
        notifications.show({ title: "Продвижение активировано", message: `Тариф «${selectedOption?.title}» активен`, color: "green" })
      } catch (e) {
        notifications.show({ title: "Ошибка", message: e instanceof Error ? e.message : "Не удалось активировать продвижение", color: "red" })
      }
    })
  }

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 800, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="violet" size={44} radius="md"><IconChartBar size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Продвижение объявления</Text>
            <Text size="xs" c="gray.5">Увеличьте просмотры и продажи в 3-10 раз</Text>
          </Stack>
        </Group>

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
              <Paper key={opt.id} radius="md" p="md" withBorder style={{ borderColor: selected === opt.id ? opt.color : "#f4f4f5", transition: "all 200ms", cursor: "pointer", position: "relative" }}
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

        <Paper radius="md" p="md" withBorder style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
          <Group gap="sm" align="center">
            <IconShieldCheck size={20} color="#059669" />
            <Text size="xs" c="#15803d">Гарантия возврата средств, если не будет просмотров. Безопасная оплата.</Text>
          </Group>
        </Paper>
      </Stack>

      {/* Модалка оплаты */}
      <Modal opened={modalOpen} onClose={() => { setModalOpen(false); setPaid(false) }} title={paid ? "Готово!" : "Оплата продвижения"} centered size="sm">
        {paid ? (
          <Stack gap="md" align="center" py="md">
            <ThemeIcon size={56} radius="xl" color="green" variant="light"><IconCheck size={28} /></ThemeIcon>
            <Stack gap={0} align="center">
              <Text fw={700} fz="lg" c="dark.9">Продвижение активировано!</Text>
              <Text size="sm" c="gray.5" ta="center">Тариф «{selectedOption?.title}» активен {selectedOption?.days} дней</Text>
            </Stack>
            <Button fullWidth radius="md" onClick={() => { setModalOpen(false); setPaid(false) }}>Отлично</Button>
          </Stack>
        ) : (
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
                <Text size="xs" c="gray.4" ta="center">Демо-режим: оплата не списывается</Text>
              </>
            )}
          </Stack>
        )}
      </Modal>
    </Box>
  )
}
