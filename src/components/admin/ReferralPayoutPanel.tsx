"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Alert, Badge, Box, Button, Card, Group, Loader, Modal, NumberInput, Stack, Table, Text, TextInput, ThemeIcon,
} from "@mantine/core"
import { IconCoins, IconWallet } from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

type PartnerBalance = {
  partnerId: string
  name: string | null
  email: string | null
  telegramUsername: string | null
  tier: { percent: number; label: string }
  paidInvitees: number
  accruedRub: number
  paidOutRub: number
  availableRub: number
}

export default function ReferralPayoutPanel() {
  const { data, error, isLoading, mutate } = useSWR<{ partners: PartnerBalance[] }>(
    "/api/admin/referral",
    fetchJson,
    { revalidateOnFocus: false },
  )
  const [target, setTarget] = useState<PartnerBalance | null>(null)
  const [form, setForm] = useState({ amount: "" as string | number, method: "Расчётный счёт", reference: "", comment: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const partners = data?.partners || []
  const totalOwed = partners.reduce((sum, partner) => sum + partner.availableRub, 0)

  const openPayout = (partner: PartnerBalance) => {
    setTarget(partner)
    setActionError(null)
    // Сумма предзаполняется полным долгом: чаще всего переводят его целиком.
    setForm({ amount: partner.availableRub, method: "Расчётный счёт", reference: "", comment: "" })
  }

  const save = async () => {
    if (!target) return
    setIsSaving(true)
    setActionError(null)
    try {
      const response = await fetch("/api/admin/referral", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partnerId: target.partnerId,
          amountRub: Number(form.amount),
          method: form.method,
          reference: form.reference,
          comment: form.comment,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setActionError(typeof payload?.error === "string" ? payload.error : "Не удалось записать выплату")
        return
      }
      setTarget(null)
      await mutate()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
        <Group gap="sm">
          <ThemeIcon variant="light" color="teal" size={36} radius="md"><IconCoins size={18} /></ThemeIcon>
          <Stack gap={1}>
            <Text size="sm" fw={750}>Выплаты партнёрам</Text>
            <Text size="xs" c="dimmed">
              Переводите по расчётному счёту и вносите запись — партнёр сразу увидит её в кабинете.
            </Text>
          </Stack>
        </Group>
        {totalOwed > 0 && (
          <Badge variant="light" color="orange" size="lg">К выплате: {totalOwed.toLocaleString("ru-RU")} ₽</Badge>
        )}
      </Group>

      {actionError && <Alert color="red" variant="light" mb="sm">{actionError}</Alert>}

      {error ? (
        <AsyncErrorState title="Реестр недоступен" description="Не удалось загрузить балансы партнёров." onRetry={() => mutate()} />
      ) : isLoading ? (
        <Group justify="center" py="lg"><Loader size="sm" /></Group>
      ) : partners.length ? (
        <Box style={{ overflowX: "auto" }}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Партнёр</Table.Th>
                <Table.Th>Ставка</Table.Th>
                <Table.Th ta="right">Начислено</Table.Th>
                <Table.Th ta="right">Выплачено</Table.Th>
                <Table.Th ta="right">К выплате</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {partners.map((partner) => (
                <Table.Tr key={partner.partnerId}>
                  <Table.Td>
                    <Text size="sm" fw={600}>{partner.name || partner.email || partner.partnerId}</Text>
                    <Text size="10px" c="dimmed">
                      {partner.telegramUsername ? `@${partner.telegramUsername} · ` : ""}
                      {partner.paidInvitees} с оплатой
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light" color="indigo">{partner.tier.percent}%</Badge>
                  </Table.Td>
                  <Table.Td ta="right"><Text size="sm">{partner.accruedRub.toLocaleString("ru-RU")} ₽</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm" c="dimmed">{partner.paidOutRub.toLocaleString("ru-RU")} ₽</Text></Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" fw={800} c={partner.availableRub > 0 ? "teal" : "dimmed"}>
                      {partner.availableRub.toLocaleString("ru-RU")} ₽
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="compact-xs"
                      color="teal"
                      variant="light"
                      leftSection={<IconWallet size={13} />}
                      disabled={partner.availableRub <= 0}
                      onClick={() => openPayout(partner)}
                    >
                      Записать выплату
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      ) : (
        <Text size="sm" c="dimmed">
          Начислений пока нет. Партнёры появятся здесь после первой оплаты приглашённого.
        </Text>
      )}

      <Modal opened={Boolean(target)} onClose={() => setTarget(null)} title="Записать выплату" centered>
        <Stack gap="sm">
          <Alert color="indigo" variant="light">
            <Text size="sm" fw={700}>{target?.name || target?.email}</Text>
            <Text size="xs" c="dimmed" mt={2}>
              Доступно к выплате: {target?.availableRub.toLocaleString("ru-RU")} ₽
            </Text>
          </Alert>

          <NumberInput
            required
            label="Сумма перевода, ₽"
            description="Запись фиксирует уже проведённый перевод, а не отправляет деньги"
            min={1}
            max={target?.availableRub}
            value={form.amount}
            onChange={(value) => setForm({ ...form, amount: value })}
            thousandSeparator=" "
          />
          <TextInput label="Способ" placeholder="Расчётный счёт" value={form.method} onChange={(event) => setForm({ ...form, method: event.currentTarget.value })} />
          <TextInput label="Номер платёжного поручения" placeholder="1234" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.currentTarget.value })} />
          <TextInput label="Комментарий" placeholder="Необязательно" value={form.comment} onChange={(event) => setForm({ ...form, comment: event.currentTarget.value })} />

          {actionError && <Alert color="red" variant="light">{actionError}</Alert>}

          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setTarget(null)}>Отмена</Button>
            <Button color="teal" onClick={save} loading={isSaving} disabled={!Number(form.amount)}>
              Записать выплату
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}
