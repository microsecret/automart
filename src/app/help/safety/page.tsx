"use client"
export const dynamic = "force-dynamic"
import { Box, Stack, Title, Text, Card, Group, ThemeIcon, SimpleGrid } from "@mantine/core"
import { IconShieldCheck, IconEye, IconWallet, IconAlertTriangle, IconPhone, IconCheck } from "@tabler/icons-react"

const TIPS = [
  { icon: <IconEye size={18} />, title: "Проверяйте авто лично", desc: "Осмотрите авто при дневном свете, проверьте все документы" },
  { icon: <IconWallet size={18} />, title: "Не предоплата", desc: "Никогда не переводите деньги до осмотра авто" },
  { icon: <IconAlertTriangle size={18} />, title: "Заниженная цена = мошенники", desc: "Если цена намного ниже рынка — это подозрительно" },
  { icon: <IconCheck size={18} />, title: "VIN-паспорт", desc: "Проверяйте авто по VIN перед покупкой" },
  { icon: <IconShieldCheck size={18} />, title: "Безопасная сделка", desc: "Используйте эскроу-сервис для защиты денег" },
  { icon: <IconPhone size={18} />, title: "Встречайтесь в людном месте", desc: "Осмотр — в безопасном месте, лучше с другом" },
]

export default function HelpSafetyPage() {
  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 700, margin: "0 auto" }}>
      <Stack gap="md">
        <Title order={2} size="h3" ff="var(--font-display),sans-serif">Безопасность сделок</Title>
        <Text size="sm" c="#71717a">Следуйте этим правилам, чтобы не стать жертвой мошенников</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {TIPS.map((tip, i) => (
            <Card key={i} withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
              <Group gap="sm" align="flex-start">
                <ThemeIcon variant="light" color="red" size={32} radius="md">{tip.icon}</ThemeIcon>
                <Stack gap={2}><Text size="sm" fw={600} c="#18181b">{tip.title}</Text><Text size="xs" c="#71717a" lh={1.4}>{tip.desc}</Text></Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Box>
  )
}
