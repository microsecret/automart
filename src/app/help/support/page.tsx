"use client"

import Link from "next/link"
import { Alert, Box, Button, Card, Group, List, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core"
import { IconBook2, IconHeadset, IconLock, IconMessageCircle2, IconRobot, IconUserCheck } from "@tabler/icons-react"

const HELP_LINKS = [
  { href: "/auth/signup", label: "Регистрация на сайте" },
  { href: "/auth/telegram", label: "Вход через Telegram" },
  { href: "/listings/create/vehicle", label: "Подача объявления" },
  { href: "/auctions", label: "Автомобили из-за рубежа" },
  { href: "/help/safety", label: "Безопасность сделки" },
]

export default function HelpSupportPage() {
  const openSupport = () => window.dispatchEvent(new Event("lewheel:open-support"))

  return (
    <Box p={{ base: "sm", md: "xl" }} maw={900} w="100%" mx="auto" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
      <Stack gap="xl">
        <Stack gap="xs" ta="center" align="center">
          <ThemeIcon size={58} radius="xl" variant="gradient" gradient={{ from: "indigo", to: "violet" }}><IconHeadset size={28} /></ThemeIcon>
          <Title order={1} fz={{ base: 30, sm: 40 }} lh={1.1}>Поддержка LeWheel</Title>
          <Text c="dimmed" maw={650}>Задайте вопрос без регистрации. Переписка сохранится в этом браузере, а после входа может быть привязана к вашему кабинету.</Text>
          <Button size="md" leftSection={<IconMessageCircle2 size={18} />} onClick={openSupport}>Открыть чат</Button>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Card withBorder radius="lg" p="lg">
            <Stack gap="sm"><ThemeIcon variant="light" color="indigo" radius="md"><IconRobot size={18} /></ThemeIcon><Text fw={750}>Сначала — инструкция</Text><Text size="sm" c="dimmed">Помощник отвечает по проверенной базе знаний: регистрация, объявления, аукционы, доставка и безопасность.</Text></Stack>
          </Card>
          <Card withBorder radius="lg" p="lg">
            <Stack gap="sm"><ThemeIcon variant="light" color="teal" radius="md"><IconUserCheck size={18} /></ThemeIcon><Text fw={750}>Затем — оператор</Text><Text size="sm" c="dimmed">Если ответа недостаточно, нажмите «Позвать оператора». Сотрудник увидит историю и продолжит диалог в том же окне.</Text></Stack>
          </Card>
          <Card withBorder radius="lg" p="lg">
            <Stack gap="sm"><ThemeIcon variant="light" color="blue" radius="md"><IconLock size={18} /></ThemeIcon><Text fw={750}>Контакт — по желанию</Text><Text size="sm" c="dimmed">Гость может оставить имя, телефон или email. Пароли, коды входа и платёжные данные поддержка не запрашивает.</Text></Stack>
          </Card>
        </SimpleGrid>

        <Card withBorder radius="lg" p={{ base: "md", sm: "xl" }}>
          <Group align="flex-start" gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon variant="light" color="grape" size={40} radius="md" style={{ flexShrink: 0 }}><IconBook2 size={20} /></ThemeIcon>
            <Stack gap="sm" style={{ minWidth: 0 }}>
              <div><Title order={3}>Быстрые инструкции</Title><Text size="sm" c="dimmed">Откройте нужный раздел или задайте уточняющий вопрос помощнику.</Text></div>
              <List spacing="xs">
                {HELP_LINKS.map((item) => <List.Item key={item.href}><Text component={Link} href={item.href} c="indigo" fw={650}>{item.label}</Text></List.Item>)}
              </List>
            </Stack>
          </Group>
        </Card>

        <Alert color="orange" title="Важно">
          Онлайн-помощник доступен автоматически. Время ответа живого оператора зависит от текущей очереди — мы не показываем вымышленные сроки и не обещаем круглосуточное присутствие сотрудника.
        </Alert>
      </Stack>
    </Box>
  )
}
