import Link from "next/link"
import { Box, Stack, Title, Text, Card, Group, ThemeIcon, SimpleGrid, Button, Alert } from "@mantine/core"
import { IconShieldCheck, IconCheck, IconWallet, IconFileCheck, IconKey } from "@tabler/icons-react"

const STEPS = [
  { icon: <IconWallet size={20} />, title: "Заявка и договор", desc: "Покупатель и партнёр фиксируют состав услуги, стоимость и реквизиты до начала работы" },
  { icon: <IconFileCheck size={20} />, title: "Проверка документов", desc: "Проверяем сведения об объявлении и документы продавца перед ключевыми этапами" },
  { icon: <IconKey size={20} />, title: "Контроль этапов", desc: "Покупатель видит статусы, документы и следующий шаг в личном кабинете" },
  { icon: <IconCheck size={20} />, title: "Передача авто", desc: "Оплата и передача оформляются по согласованным сторонами документам" },
]

export default function SafeDealPage() {
  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 700, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="green" size={44} radius="md"><IconShieldCheck size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Title order={1} size="h3" ff="var(--font-display),sans-serif">Сопровождаемая сделка</Title>
            <Text size="xs" c="gray.5">Проверка, документы и прозрачные этапы без лишних рисков</Text>
          </Stack>
        </Group>

        <Card withBorder radius="md" p="lg" style={{ borderColor: "var(--mantine-color-border)", background: "var(--market-success-surface)" }}>
          <Text size="sm" c="gray.6" lh={1.6}>
            Сопровождаемая сделка помогает проверить продавца, собрать документы и контролировать путь покупки. Площадка пока не принимает и не удерживает деньги: платежи выполняются напрямую по согласованным реквизитам.
          </Text>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {STEPS.map((step, i) => (
            <Card key={i} withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm" align="flex-start">
                <ThemeIcon variant="light" color="green" size={36} radius="md">{step.icon}</ThemeIcon>
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="xs" c="gray.4">Шаг {i + 1}</Text>
                  <Text size="sm" fw={600} c="var(--market-ink)">{step.title}</Text>
                  <Text size="xs" c="gray.5" lh={1.4}>{step.desc}</Text>
                </Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
          <Stack gap="xs">
            <Text size="sm" fw={600} c="var(--market-ink)">Что входит:</Text>
            {["Проверка сведений об объявлении и продавце", "Статусы, документы и чат по сделке", "Подготовка заявок и квитанций", "Поддержка на ключевых этапах", "Понятный следующий шаг для покупателя"].map((item) => (
              <Group key={item} gap={6}><IconCheck size={14} color="#16a34a" /><Text size="xs" c="gray.6">{item}</Text></Group>
            ))}
          </Stack>
        </Card>

        <Alert color="indigo" variant="light" radius="md">
          <Text size="xs" c="#1c4291">Сервис развивается. Банковское или платёжное сопровождение появится только после подключения лицензированного провайдера.</Text>
        </Alert>

        <Group grow>
          <Button component={Link} href="/dashboard/deliveries" color="indigo">Открыть кабинет сделок</Button>
          <Button component={Link} href="/auctions" variant="light" color="indigo">Посмотреть аукционы</Button>
        </Group>
      </Stack>
    </Box>
  )
}

