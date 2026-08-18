"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Alert, Badge, Box, Button, Card, Container, CopyButton, Group, Loader, Progress,
  SimpleGrid, Stack, Table, Text, TextInput, ThemeIcon, Title,
} from "@mantine/core"
import { IconCheck, IconCopy, IconGift, IconUsers, IconWallet } from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

type ReferralData = {
  code: string
  link: string
  tier: { percent: number; label: string; minPaidInvitees: number }
  nextTier: { tier: { percent: number; label: string }; needed: number } | null
  stats: {
    invitedCount: number
    paidInviteesCount: number
    accruedRub: number
    paidOutRub: number
    availableRub: number
  }
  invitees: Array<{ id: string; name: string; joinedAt: string }>
  rewards: Array<{ id: string; amountRub: number; percent: number; orderAmountRub: number; status: string; createdAt: string }>
  payouts: Array<{ id: string; amountRub: number; method: string | null; reference: string | null; comment: string | null; createdAt: string }>
  payoutNote: string
}

const REWARD_STATUS: Record<string, { label: string; color: string }> = {
  ACCRUED: { label: "Начислено", color: "teal" },
  PAID: { label: "Выплачено", color: "blue" },
  CANCELLED: { label: "Отменено", color: "gray" },
}

export default function ReferralPage() {
  const { data, error, isLoading, mutate } = useSWR<ReferralData>("/api/referral", fetchJson, { revalidateOnFocus: false })
  const [tab, setTab] = useState<"invitees" | "rewards" | "payouts">("invitees")

  if (error) {
    return (
      <Container size="lg" py="xl">
        <AsyncErrorState title="Партнёрская программа недоступна" description="Не удалось загрузить статистику." onRetry={() => mutate()} />
      </Container>
    )
  }

  if (isLoading || !data) {
    return <Container size="lg" py="xl"><Group justify="center"><Loader /></Group></Container>
  }

  // Прогресс считается от порога следующей ставки, а не от процента: иначе
  // полоса заполнялась бы произвольной величиной.
  const progressToNext = data.nextTier
    ? Math.min(100, Math.round((data.stats.paidInviteesCount / (data.stats.paidInviteesCount + data.nextTier.needed)) * 100))
    : 100

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="lg">
        <Card className="store-workspace__hero" radius="lg" p={{ base: "md", sm: "lg" }}>
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <Group gap="sm" align="center" wrap="nowrap">
              <ThemeIcon variant="white" color="dark" size={46} radius="md"><IconGift size={23} /></ThemeIcon>
              <Box>
                <Badge variant="white" color="indigo" size="sm" mb={4}>ПАРТНЁРСКАЯ ПРОГРАММА</Badge>
                <Title order={1} size="h3" c="white" ff="var(--font-display),sans-serif">Приглашайте и зарабатывайте</Title>
                <Text size="sm" c="rgba(255,255,255,.76)" mt={2}>
                  Процент с платных тарифов приглашённых. Чем больше активных партнёров, тем выше ставка.
                </Text>
              </Box>
            </Group>
            <Card withBorder={false} radius="md" p="sm" bg="rgba(255,255,255,.12)">
              <Text size="xs" c="rgba(255,255,255,.7)">Ваша ставка</Text>
              <Text fw={900} size="28px" c="white" lh={1.1}>{data.tier.percent}%</Text>
              <Text size="xs" c="rgba(255,255,255,.7)">{data.tier.label}</Text>
            </Card>
          </Group>
        </Card>

        <Card withBorder radius="lg" p="md">
          <Text fw={750} size="sm" mb={4}>Ваша реферальная ссылка</Text>
          <Text size="xs" c="dimmed" mb="sm">
            Отправьте её тому, кого приглашаете. Связь закрепляется при регистрации и не меняется.
          </Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput value={data.link} readOnly style={{ flex: 1 }} />
            <CopyButton value={data.link} timeout={2000}>
              {({ copied, copy }) => (
                <Button color={copied ? "teal" : "indigo"} onClick={copy} leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}>
                  {copied ? "Скопировано" : "Копировать"}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Card withBorder radius="lg" p="md">
            <Text size="xs" c="dimmed">Приглашено</Text>
            <Text fw={850} size="xl" mt={4}>{data.stats.invitedCount}</Text>
          </Card>
          <Card withBorder radius="lg" p="md">
            <Text size="xs" c="dimmed">Из них с оплатой</Text>
            <Text fw={850} size="xl" mt={4}>{data.stats.paidInviteesCount}</Text>
          </Card>
          <Card withBorder radius="lg" p="md">
            <Text size="xs" c="dimmed">Начислено всего</Text>
            <Text fw={850} size="xl" mt={4}>{data.stats.accruedRub.toLocaleString("ru-RU")} ₽</Text>
          </Card>
          <Card withBorder radius="lg" p="md">
            <Text size="xs" c="dimmed">Доступно к выплате</Text>
            <Text fw={850} size="xl" mt={4} c={data.stats.availableRub > 0 ? "teal" : undefined}>
              {data.stats.availableRub.toLocaleString("ru-RU")} ₽
            </Text>
          </Card>
        </SimpleGrid>

        {data.nextTier && (
          <Card withBorder radius="lg" p="md">
            <Group justify="space-between" gap="xs" wrap="wrap" mb={6}>
              <Text size="sm" fw={700}>
                До ставки {data.nextTier.tier.percent}% нужно ещё {data.nextTier.needed}
              </Text>
              <Badge variant="light" color="indigo">{data.nextTier.tier.label}</Badge>
            </Group>
            <Progress value={progressToNext} color="indigo" size="sm" radius="xl" />
          </Card>
        )}

        <Alert color="indigo" variant="light" icon={<IconWallet size={18} />}>
          {data.payoutNote}
        </Alert>

        <Card withBorder radius="lg" p="md">
          <Group gap="xs" mb="sm">
            {([
              { key: "invitees" as const, label: `Приглашённые (${data.invitees.length})`, icon: <IconUsers size={14} /> },
              { key: "rewards" as const, label: `Начисления (${data.rewards.length})`, icon: <IconGift size={14} /> },
              { key: "payouts" as const, label: `Выплаты (${data.payouts.length})`, icon: <IconWallet size={14} /> },
            ]).map((item) => (
              <Button
                key={item.key}
                size="compact-sm"
                variant={tab === item.key ? "light" : "subtle"}
                color={tab === item.key ? "indigo" : "gray"}
                leftSection={item.icon}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </Group>

          {tab === "invitees" && (
            data.invitees.length ? (
              <Stack gap={6}>
                {data.invitees.map((invitee) => (
                  <Group key={invitee.id} justify="space-between" gap="xs" wrap="wrap">
                    <Text size="sm">{invitee.name}</Text>
                    <Text size="xs" c="dimmed">{new Date(invitee.joinedAt).toLocaleDateString("ru-RU")}</Text>
                  </Group>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">Пока никто не перешёл по ссылке. Поделитесь ей, и приглашённые появятся здесь.</Text>
            )
          )}

          {tab === "rewards" && (
            data.rewards.length ? (
              <Box style={{ overflowX: "auto" }}>
                <Table striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Дата</Table.Th>
                      <Table.Th>Платёж</Table.Th>
                      <Table.Th>Ставка</Table.Th>
                      <Table.Th ta="right">Начислено</Table.Th>
                      <Table.Th>Статус</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.rewards.map((reward) => {
                      const meta = REWARD_STATUS[reward.status] || REWARD_STATUS.ACCRUED
                      return (
                        <Table.Tr key={reward.id}>
                          <Table.Td><Text size="xs">{new Date(reward.createdAt).toLocaleDateString("ru-RU")}</Text></Table.Td>
                          <Table.Td><Text size="xs">{reward.orderAmountRub.toLocaleString("ru-RU")} ₽</Text></Table.Td>
                          <Table.Td><Text size="xs">{reward.percent}%</Text></Table.Td>
                          <Table.Td ta="right"><Text size="sm" fw={700}>{reward.amountRub.toLocaleString("ru-RU")} ₽</Text></Table.Td>
                          <Table.Td><Badge size="xs" variant="light" color={meta.color}>{meta.label}</Badge></Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </Box>
            ) : (
              <Text size="sm" c="dimmed">Начислений пока нет. Они появляются, когда приглашённый оплачивает платный тариф.</Text>
            )
          )}

          {tab === "payouts" && (
            data.payouts.length ? (
              <Stack gap="xs">
                {data.payouts.map((payout) => (
                  <Card key={payout.id} withBorder radius="md" p="sm">
                    <Group justify="space-between" gap="xs" wrap="wrap">
                      <Text fw={750}>{payout.amountRub.toLocaleString("ru-RU")} ₽</Text>
                      <Text size="xs" c="dimmed">{new Date(payout.createdAt).toLocaleString("ru-RU")}</Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={2}>
                      {[payout.method, payout.reference, payout.comment].filter(Boolean).join(" · ") || "Перевод подтверждён администратором"}
                    </Text>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">Выплат пока не было.</Text>
            )
          )}
        </Card>
      </Stack>
    </Container>
  )
}
