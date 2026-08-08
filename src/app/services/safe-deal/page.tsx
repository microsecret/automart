"use client"
export const dynamic = "force-dynamic"
import { Box, Stack, Title, Text, Card, Group, ThemeIcon, SimpleGrid, Divider, Button, Alert } from "@mantine/core"
import { IconShieldCheck, IconCheck, IconWallet, IconFileCheck, IconKey } from "@tabler/icons-react"

const STEPS = [
  { icon: <IconWallet size={20} />, title: "Деньги на счёте", desc: "Покупатель переводит деньги на защищённый счёт платформы" },
  { icon: <IconFileCheck size={20} />, title: "Проверка документов", desc: "Платформа проверяет документы авто и продавца" },
  { icon: <IconKey size={20} />, title: "Передача авто", desc: "Продавец передаёт авто и ключи покупателю" },
  { icon: <IconCheck size={20} />, title: "Деньги продавцу", desc: "После подтверждения — деньги перечисляются продавцу" },
]

export default function SafeDealPage() {
  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 700, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="green" size={44} radius="md"><IconShieldCheck size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Title order={2} size="h3" ff="var(--font-display),sans-serif">Безопасная сделка</Title>
            <Text size="xs" c="#71717a">Защита от мошенничества с эскроу-сервисом</Text>
          </Stack>
        </Group>

        <Card withBorder radius="md" p="lg" style={{ borderColor: "#f4f4f5", background: "#f0fdf4" }}>
          <Text size="sm" c="#52525b" lh={1.6}>
            Безопасная сделка — это эскроу-сервис: деньги покупателя находятся на защищённом счёте платформы до момента, когда сделка завершена и обе стороны довольны. Если что-то пойдёт не так — деньги вернутся покупателю.
          </Text>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {STEPS.map((step, i) => (
            <Card key={i} withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
              <Group gap="sm" align="flex-start">
                <ThemeIcon variant="light" color="green" size={36} radius="md">{step.icon}</ThemeIcon>
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="xs" c="#a1a1aa">Шаг {i + 1}</Text>
                  <Text size="sm" fw={600} c="#18181b">{step.title}</Text>
                  <Text size="xs" c="#71717a" lh={1.4}>{step.desc}</Text>
                </Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        <Card withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
          <Stack gap="xs">
            <Text size="sm" fw={600} c="#18181b">Что входит:</Text>
            {["Проверка юридической чистоты авто", "Защита денег до передачи авто", "Страхование сделки", "Поддержка на всех этапах", "Возврат при отмене"].map((item) => (
              <Group key={item} gap={6}><IconCheck size={14} color="#16a34a" /><Text size="xs" c="#52525b">{item}</Text></Group>
            ))}
          </Stack>
        </Card>

        <Alert color="indigo" variant="light" radius="md">
          <Text size="xs" c="#4f46e5">Демо-режим. Интеграция с платёжной системой и банком будет подключена позже.</Text>
        </Alert>
      </Stack>
    </Box>
  )
}

