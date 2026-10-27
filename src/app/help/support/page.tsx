"use client"

import SectionArtworkHeader from "@/components/ui/SectionArtworkHeader"
import ServiceArtwork from "@/components/ui/ServiceArtwork"

import Link from "next/link"
import { Alert, Box, Button, Card, Group, List, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import { IconMessageCircle2 } from "@tabler/icons-react"

const HELP_LINKS = [
  { href: "/auth/signup", label: "Регистрация через Telegram-бота" },
  { href: "/auth/signin", label: "Вход по почте или телефону" },
  { href: "/listings/create/vehicle", label: "Подача объявления" },
  { href: "/auctions", label: "Автомобили из-за рубежа" },
  { href: "/help/safety", label: "Безопасность сделки" },
]

export default function HelpSupportPage() {
  const openSupport = () => window.dispatchEvent(new Event("lewheel:open-support"))

  return (
    <Box p={{ base: "sm", md: "xl" }} maw={900} w="100%" mx="auto" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
      <Stack gap="xl">
        <SectionArtworkHeader scene="help" title="Поддержка LeWheel">
          <p>Задайте вопрос без регистрации. Переписка сохранится в этом браузере, а после входа может быть привязана к вашему кабинету.</p>
          <Button mt="md" size="md" leftSection={<IconMessageCircle2 size={18} />} onClick={openSupport}>Открыть чат</Button>
        </SectionArtworkHeader>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Card withBorder radius="md" p="lg">
            <Stack gap="sm"><ServiceArtwork kind="documents" size={44} /><Text fw={700}>Сначала — инструкция</Text><Text size="sm" c="dimmed">Помощник отвечает по проверенной базе знаний: регистрация, объявления, аукционы, доставка и безопасность.</Text></Stack>
          </Card>
          <Card withBorder radius="md" p="lg">
            <Stack gap="sm"><ServiceArtwork kind="messages" size={44} /><Text fw={700}>Затем — оператор</Text><Text size="sm" c="dimmed">Если ответа недостаточно, нажмите «Позвать оператора». Сотрудник увидит историю и продолжит диалог в том же окне.</Text></Stack>
          </Card>
          <Card withBorder radius="md" p="lg">
            <Stack gap="sm"><ServiceArtwork kind="safe-deal" size={44} /><Text fw={700}>Контакт — по желанию</Text><Text size="sm" c="dimmed">Гость может оставить имя, телефон или email. Пароли, коды входа и платёжные данные поддержка не запрашивает.</Text></Stack>
          </Card>
        </SimpleGrid>

        <Card withBorder radius="md" p={{ base: "md", sm: "xl" }}>
          <Group align="flex-start" gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
            <ServiceArtwork kind="documents" size={40} />
            <Stack gap="sm" style={{ minWidth: 0 }}>
              <div><Title order={3}>Быстрые инструкции</Title><Text size="sm" c="dimmed">Откройте нужный раздел или задайте уточняющий вопрос помощнику.</Text></div>
              <List spacing="xs">
                {HELP_LINKS.map((item) => <List.Item key={item.href}><Text component={Link} href={item.href} c="indigo" fw={600}>{item.label}</Text></List.Item>)}
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
