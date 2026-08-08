"use client"
export const dynamic = "force-dynamic"
import { Box, Stack, Title, Text, Center, Button, ThemeIcon, SimpleGrid, Card, Group, Badge } from "@mantine/core"
import { IconLayoutDashboard, IconTag, IconHeart, IconEye, IconStar, IconCar, IconTool, IconSettings, IconPlus } from "@tabler/icons-react"
import Link from "next/link"

export default function DashboardPage() {
  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconLayoutDashboard size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Title order={2} size="h3" ff="var(--font-display),sans-serif">Личный кабинет</Title>
            <Text size="xs" c="#71717a">Управляйте объявлениями и профилем</Text>
          </Stack>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {[
            { label: "Объявления", icon: <IconTag size={18} />, color: "indigo", href: "/dashboard" },
            { label: "Избранное", icon: <IconHeart size={18} />, color: "red", href: "/favorites" },
            { label: "Просмотры", icon: <IconEye size={18} />, color: "blue", href: "/dashboard" },
            { label: "Отзывы", icon: <IconStar size={18} />, color: "orange", href: "/reviews" },
          ].map((s) => (
            <Card key={s.label} withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5" }} component={Link} href={s.href}>
              <Group gap="sm" align="center">
                <ThemeIcon variant="light" color={s.color} size={36} radius="md">{s.icon}</ThemeIcon>
                <Stack gap={0}><Text size="lg" fw={700} c="#18181b">0</Text><Text size="xs" c="#71717a">{s.label}</Text></Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Card component={Link} href="/listings/create/vehicle" withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
            <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconPlus size={18} /></ThemeIcon><Stack gap={0}><Text size="sm" fw={600}>Разместить</Text><Text size="xs" c="#71717a">Новое объявление</Text></Stack></Group>
          </Card>
          <Card component={Link} href="/dashboard" withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
            <Group gap="sm"><ThemeIcon variant="light" color="green" size={36} radius="md"><IconCar size={18} /></ThemeIcon><Stack gap={0}><Text size="sm" fw={600}>Гараж</Text><Text size="xs" c="#71717a">Мои авто</Text></Stack></Group>
          </Card>
          <Card component={Link} href="/dashboard" withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5" }}>
            <Group gap="sm"><ThemeIcon variant="light" color="violet" size={36} radius="md"><IconSettings size={18} /></ThemeIcon><Stack gap={0}><Text size="sm" fw={600}>Настройки</Text><Text size="xs" c="#71717a">Профиль</Text></Stack></Group>
          </Card>
        </SimpleGrid>

        <Button component={Link} href="/listings/create/vehicle" leftSection={<IconPlus size={16} />} color="indigo" radius="md" size="sm">Разместить объявление</Button>
      </Stack>
    </Box>
  )
}
