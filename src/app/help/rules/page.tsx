"use client"
export const dynamic = "force-dynamic"
import { Box, Stack, Text, Paper, ThemeIcon, Group, SimpleGrid, Badge, Divider, List } from "@mantine/core"
import { IconScale, IconCheck, IconX, IconInfoCircle } from "@tabler/icons-react"

export default function RulesPage() {
  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md" maw={800} mx="auto">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="violet" size={44} radius="md"><IconScale size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={24} c="var(--market-ink)" ff="var(--font-display),sans-serif">Правила площадки</Text>
            <Text size="xs" c="gray.5">Обновлены: 8 августа 2026</Text>
          </Stack>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Paper radius="md" p="lg" withBorder style={{ background: "var(--market-success-surface)", borderColor: "var(--market-success-line)" }}>
            <Group gap="sm" mb="sm"><ThemeIcon variant="light" color="green" size={32} radius="md"><IconCheck size={18} /></ThemeIcon><Text fw={700} c="var(--market-ink)">Разрешено</Text></Group>
            <List size="sm" c="gray.6" spacing={6}>
              <List.Item>Продажа личного транспорта и запчастей</List.Item>
              <List.Item>Объявления от дилеров (с указанием)</List.Item>
              <List.Item>Контрактные запчасти (с пометкой)</List.Item>
              <List.Item>Услуги автосервисов, эвакуаторов</List.Item>
              <List.Item>Фото и видео реального товара</List.Item>
            </List>
          </Paper>
          <Paper radius="md" p="lg" withBorder style={{ background: "var(--market-danger-surface)", borderColor: "var(--market-danger-line)" }}>
            <Group gap="sm" mb="sm"><ThemeIcon variant="light" color="red" size={32} radius="md"><IconX size={18} /></ThemeIcon><Text fw={700} c="var(--market-ink)">Запрещено</Text></Group>
            <List size="sm" c="gray.6" spacing={6}>
              <List.Item>Краденое имущество, документы</List.Item>
              <List.Item>Товары без выкупа</List.Item>
              <List.Item>Повторные объявления (дубли)</List.Item>
              <List.Item>Невозможные цены для приманки</List.Item>
              <List.Item>Оружие, наркотики, контрафакт</List.Item>
              <List.Item>Спам, фишинг, обман</List.Item>
            </List>
          </Paper>
        </SimpleGrid>

        <Divider label={<Badge variant="light" color="indigo">Модерация</Badge>} labelPosition="center" />

        <Stack gap="sm">
          {[
            { title: "Срок модерации", text: "Объявления проверяются автоматически и вручную. Обычно от 5 минут до 2 часов." },
            { title: "Причины отклонения", text: "Недостоверное описание, чужие фото, несоответствие цены. Уведомление с причиной придёт автоматически." },
            { title: "Блокировка", text: "За систематические нарушения — блокировка без восстановления аккаунта." },
            { title: "Жалобы", text: "Заметили нарушение? Нажмите «Пожаловаться» на объявлении. Проверим за 24 часа." },
          ].map((s) => (
            <Paper key={s.title} radius="md" p="md" withBorder>
              <Group gap="sm" align="flex-start">
                <ThemeIcon variant="light" color="indigo" size={28} radius="md"><IconInfoCircle size={16} /></ThemeIcon>
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text fw={700} fz="sm" c="var(--market-ink)">{s.title}</Text>
                  <Text size="sm" c="gray.6" lh={1.5}>{s.text}</Text>
                </Stack>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Stack>
    </Box>
  )
}
