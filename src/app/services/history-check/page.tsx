"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import { Box, Stack, Title, Text, Card, TextInput, Button, Group, ThemeIcon, SimpleGrid, Divider, ThemeIcon as TI } from "@mantine/core"
import { IconHistory, IconCheck, IconX, IconShieldCheck } from "@tabler/icons-react"

export default function HistoryCheckPage() {
  const [vin, setVin] = useState("")
  const [checked, setChecked] = useState(false)

  const check = () => { if (vin.length >= 10) setChecked(true) }

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 600, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="green" size={44} radius="md"><IconHistory size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Title order={2} size="h3" ff="var(--font-display),sans-serif">Проверка истории</Title>
            <Text size="xs" c="#71717a">Полный отчёт по VIN: ДТП, пробег, ограничения, розыск</Text>
          </Stack>
        </Group>

        <Card withBorder radius="md" p="lg" style={{ borderColor: "#f4f4f5" }}>
          <Stack gap="md">
            <TextInput label="VIN номер" placeholder="17 символов" value={vin} onChange={(e) => setVin(e.currentTarget.value.toUpperCase())} size="sm" maxLength={17} />
            <Button onClick={check} color="indigo" radius="md" disabled={vin.length < 10} leftSection={<IconShieldCheck size={18} />}>Проверить</Button>
          </Stack>
        </Card>

        {checked && (
          <Card withBorder radius="md" p="lg" style={{ borderColor: "#bbf7d0", background: "#f0fdf4" }}>
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="#18181b">Отчёт по VIN: {vin}</Text>
              <Text size="xs" c="#16a34a" fw={600}>Чистая история</Text>
            </Group>
            <SimpleGrid cols={2} spacing="xs">
              {[
                { label: "ДТП", value: "Не найдено", ok: true },
                { label: "В розыске", value: "Нет", ok: true },
                { label: "Залог", value: "Нет", ok: true },
                { label: "Ограничения", value: "Нет", ok: true },
                { label: "Такси/аренда", value: "Не использовалось", ok: true },
                { label: "Утиль/тотал", value: "Нет", ok: true },
                { label: "Владельцев по ПТС", value: "2", ok: true },
                { label: "Скрученный пробег", value: "Не обнаружен", ok: true },
              ].map((item) => (
                <Group key={item.label} gap={6}>
                  <TI variant="light" color={item.ok ? "green" : "red"} size={24} radius="sm">{item.ok ? <IconCheck size={14} /> : <IconX size={14} />}</TI>
                  <Stack gap={0}>
                    <Text size="xs" c="#71717a">{item.label}</Text>
                    <Text size="xs" fw={500} c={item.ok ? "#16a34a" : "#dc2626"}>{item.value}</Text>
                  </Stack>
                </Group>
              ))}
            </SimpleGrid>
            <Divider my="sm" />
            <Text size="xs" c="#a1a1aa">Демонстрационный отчёт. В продакшене — данные из баз ЕАЭС.</Text>
          </Card>
        )}
      </Stack>
    </Box>
  )
}
