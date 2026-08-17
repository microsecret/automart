"use client"
export const dynamic = "force-dynamic"
import { Box, Stack, Text, Paper, ThemeIcon, Group, SimpleGrid, Alert } from "@mantine/core"
import { IconShieldCheck, IconAlertTriangle, IconChecks, IconEye, IconCash, IconMapPin, IconPhone } from "@tabler/icons-react"

const SAFETY_RULES = [
  { icon: IconEye, title: "Проверяйте при встрече", text: "Осмотрите авто или запчасть лично. Сверьте VIN, номера деталей. Не переводите деньги до осмотра." },
  { icon: IconCash, title: "Сопровождение оплаты", text: "Фиксируйте документы, этапы и реквизиты оплаты до передачи автомобиля." },
  { icon: IconMapPin, title: "Встречайтесь в людных местах", text: "Днём, на охраняемых парковках или в ГИБДД для проверки авто. Не ездите в гаражи одни." },
  { icon: IconPhone, title: "Не давайте предоплату", text: "Требование предоплаты на карту — частый приём мошенников. Особенно «Сбербанк Онлайн» на чужое имя." },
]

const SCAM_SIGNS = [
  "Цена ниже рынка на 30-50% без причины",
  "Продавец за границей, авто «в пути»",
  "Просьба перевести задаток до осмотра",
  "Отказ от встречи, только доставка",
  "VIN не пробивается или не совпадает",
  "Только мессенджеры, без звонков",
]

export default function SafetyPage() {
  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md" maw={800} mx="auto">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="red" size={44} radius="md"><IconShieldCheck size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={24} c="dark.9" ff="var(--font-display),sans-serif">Безопасность</Text>
            <Text size="xs" c="gray.5">Как не стать жертвой мошенников</Text>
          </Stack>
        </Group>

        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" radius="md" title="Главное правило">
          Никогда не переводите деньги до осмотра товара и проверки реквизитов. Для сложной покупки оформляйте сопровождаемую сделку с понятными документами и этапами.
        </Alert>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {SAFETY_RULES.map((r) => {
            const Icon = r.icon
            return (
              <Paper key={r.title} radius="md" p="md" withBorder>
                <Group gap="sm" align="flex-start">
                  <ThemeIcon variant="light" color="green" size={36} radius="md"><Icon size={20} /></ThemeIcon>
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Text fw={700} fz="sm" c="dark.9">{r.title}</Text>
                    <Text size="xs" c="gray.6" lh={1.5}>{r.text}</Text>
                  </Stack>
                </Group>
              </Paper>
            )
          })}
        </SimpleGrid>

        <Paper radius="md" p="lg" withBorder style={{ background: "var(--market-caution-surface)", borderColor: "var(--market-caution-line)" }}>
          <Group gap="sm" mb="md">
            <ThemeIcon variant="light" color="orange" size={32} radius="md"><IconAlertTriangle size={18} /></ThemeIcon>
            <Text fw={700} c="dark.9">Признаки мошенничества</Text>
          </Group>
          <Stack gap={8}>
            {SCAM_SIGNS.map((s) => (
              <Group key={s} gap={8}>
                <IconChecks size={16} color="#d97706" />
                <Text size="sm" c="gray.7">{s}</Text>
              </Group>
            ))}
          </Stack>
        </Paper>

        <Paper radius="md" p="md" withBorder style={{ background: "var(--market-success-surface)", borderColor: "var(--market-success-line)" }}>
          <Group gap="sm" align="center">
            <ThemeIcon variant="light" color="green" size={36} radius="md"><IconShieldCheck size={20} /></ThemeIcon>
            <Stack gap={0} style={{ flex: 1 }}>
              <Text fw={700} fz="sm" c="dark.9">Сопровождаемая сделка помогает контролировать процесс</Text>
              <Text size="xs" c="gray.6">Проверка продавца, документы, статусы и поддержка. Площадка не удерживает деньги до подключения лицензированного платёжного провайдера.</Text>
            </Stack>
          </Group>
        </Paper>
      </Stack>
    </Box>
  )
}
