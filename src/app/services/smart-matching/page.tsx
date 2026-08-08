"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import { Box, Stack, Title, Text, Card, Select, NumberInput, Button, Group, ThemeIcon, Alert, Checkbox } from "@mantine/core"
import { IconTarget, IconSparkles } from "@tabler/icons-react"

export default function SmartMatchingPage() {
  const [budget, setBudget] = useState(3000000)
  const [bodyType, setBodyType] = useState("SUV")
  const [fuel, setFuel] = useState("GASOLINE")
  const [submitted, setSubmitted] = useState(false)

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 600, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="violet" size={44} radius="md"><IconTarget size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Title order={2} size="h3" ff="var(--font-display),sans-serif">Умный подбор</Title>
            <Text size="xs" c="#71717a">ИИ подберёт идеальный авто под ваши критерии</Text>
          </Stack>
        </Group>

        <Card withBorder radius="md" p="lg" style={{ borderColor: "#f4f4f5" }}>
          <Stack gap="md">
            <NumberInput label="Бюджет, ₽" value={budget} onChange={(v) => setBudget(Number(v) || 0)} size="sm" />
            <Select label="Тип кузова" data={[{ value: "SEDAN", label: "Седан" }, { value: "SUV", label: "Внедорожник" }, { value: "HATCHBACK", label: "Хэтчбек" }, { value: "WAGON", label: "Универсал" }]} value={bodyType} onChange={setBodyType} size="sm" />
            <Select label="Двигатель" data={[{ value: "GASOLINE", label: "Бензин" }, { value: "DIESEL", label: "Дизель" }, { value: "HYBRID", label: "Гибрид" }, { value: "ELECTRIC", label: "Электро" }]} value={fuel} onChange={setFuel} size="sm" />
            <Button onClick={() => setSubmitted(true)} color="indigo" radius="md" leftSection={<IconSparkles size={18} />}>Подобрать</Button>
          </Stack>
        </Card>

        {submitted && (
          <Alert icon={<IconSparkles size={16} />} color="violet" variant="light" radius="md">
            <Stack gap="xs">
              <Text size="sm" fw={600}>Рекомендации ИИ:</Text>
              <Text size="xs" c="#52525b">На основе вашего бюджета ({budget.toLocaleString("ru-RU")} ₽) и предпочтений ({bodyType}, {fuel}) мы подбираем лучшие варианты. Перейдите в <a href={`/category/cars`} style={{ color: "#4f46e5" }}>каталог</a> для просмотра.</Text>
            </Stack>
          </Alert>
        )}
      </Stack>
    </Box>
  )
}
