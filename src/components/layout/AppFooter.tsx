"use client"

import { Box, Text, Group, Stack, Container, Divider, Anchor, ActionIcon, ThemeIcon } from "@mantine/core"
import Link from "next/link"
import { IconBrandTelegram, IconBrandVk, IconBrandYoutube, IconCar } from "@tabler/icons-react"

const FOOTER_SECTIONS = [
  {
    title: "Транспорт",
    links: [
      { label: "Легковые", href: "/category/cars" },
      { label: "Мото", href: "/category/moto" },
      { label: "Грузовики", href: "/category/trucks" },
      { label: "Спецтехника", href: "/category/special" },
      { label: "Водный транспорт", href: "/category/water" },
      { label: "Авиа", href: "/category/air" },
    ],
  },
  {
    title: "Запчасти",
    links: [
      { label: "Все запчасти", href: "/parts-finder" },
      { label: "Ходовая / Подвеска", href: "/parts-finder?type=SUSPENSION" },
      { label: "Рулевое управление", href: "/parts-finder?type=STEERING" },
      { label: "Тормоза", href: "/parts-finder?type=BRAKES" },
      { label: "Электрика", href: "/parts-finder?type=ELECTRICAL" },
      { label: "Оптика / Фары", href: "/parts-finder?type=LIGHTING" },
      { label: "Двигатель", href: "/parts-finder?type=ENGINE" },
      { label: "Кузов", href: "/parts-finder?type=BODY" },
    ],
  },
  {
    title: "Сервисы",
    links: [
      { label: "Оценка стоимости", href: "/services/valuation" },
      { label: "Проверка истории", href: "/services/history-check" },
      { label: "Умный подбор", href: "/services/smart-matching" },
      { label: "Безопасная сделка", href: "/services/safe-deal" },
    ],
  },
  {
    title: "Помощь",
    links: [
      { label: "Как продать авто", href: "/help/sell" },
      { label: "Безопасность", href: "/help/safety" },
      { label: "Правила", href: "/help/rules" },
      { label: "Поддержка", href: "/help/support" },
    ],
  },
]

const SOCIALS = [
  { icon: IconBrandTelegram, href: "#", label: "Telegram", color: "#0088cc" },
  { icon: IconBrandVk, href: "#", label: "ВКонтакте", color: "#0077FF" },
  { icon: IconBrandYoutube, href: "#", label: "YouTube", color: "#FF0000" },
]

export default function AppFooter() {
  return (
    <Box component="footer" style={{
      width: "100%",
      background: "linear-gradient(180deg, #09090b 0%, #000000 100%)",
      borderTop: "3px solid #4f46e5",
      marginTop: 60,
    }}>
      <Container size="xl" py="xl">
        <Stack gap="lg">
          {/* Верхняя секция — бренд + колонки */}
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="xl">
            {/* Бренд */}
            <Stack maw={280} gap="sm">
              <Group gap={8} align="center">
                <Box style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <IconCar size={20} color="white" />
                </Box>
                <Text ff="var(--font-display),sans-serif" fw={800} fz={22} c="white" style={{ letterSpacing: "-0.02em" }}>
                  Авторынок
                </Text>
              </Group>
              <Text size="xs" c="#a1a1aa" lh={1.6}>
                Маркетплейс транспорта и запчастей с проверкой истории, безопасной сделкой и умным подбором.
              </Text>
              <Group gap={8}>
                {SOCIALS.map((s) => {
                  const Icon = s.icon
                  return (
                    <ActionIcon
                      key={s.label}
                      component="a"
                      href={s.href}
                      size={36}
                      radius="md"
                      variant="filled"
                      style={{ background: s.color + "20", border: "1px solid " + s.color + "40" }}
                      aria-label={s.label}
                    >
                      <Icon size={18} color={s.color} />
                    </ActionIcon>
                  )
                })}
              </Group>
            </Stack>

            {/* Колонки ссылок */}
            <Group gap={{ base: 32, md: 56 }} wrap="wrap">
              {FOOTER_SECTIONS.map((section) => (
                <Stack key={section.title} gap={8}>
                  <Text size="xs" fw={700} c="#a1a1aa" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                    {section.title}
                  </Text>
                  {section.links.map((link) => (
                    <Anchor
                      key={link.href}
                      component={Link}
                      href={link.href}
                      size="xs"
                      c="#71717a"
                      style={{ transition: "color 150ms ease" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#fff" }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#71717a" }}
                    >
                      {link.label}
                    </Anchor>
                  ))}
                </Stack>
              ))}
            </Group>
          </Group>

          <Divider color="#27272a" />

          {/* Нижняя секция */}
          <Group justify="space-between" wrap="wrap" gap="md">
            <Text size="xs" c="#52525b">© {new Date().getFullYear()} Авторынок</Text>
            <Group gap="lg">
              <Anchor component={Link} href="/about" size="xs" c="#71717a">О проекте</Anchor>
              <Anchor component={Link} href="/news" size="xs" c="#71717a">Новости</Anchor>
              <Anchor component={Link} href="/legal/privacy" size="xs" c="gray.5">Конфиденциальность</Anchor>
              <Anchor component={Link} href="/legal/terms" size="xs" c="gray.5">Условия</Anchor>
            </Group>
          </Group>
        </Stack>
      </Container>
    </Box>
  )
}
