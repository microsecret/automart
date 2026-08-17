"use client"

import { Box, Text, Group, Stack, Container, Divider, Anchor, ActionIcon, SimpleGrid } from "@mantine/core"
import Link from "next/link"
import { IconBrandTelegram } from "@tabler/icons-react"
import LeWheelBrand from "@/components/brand/LeWheelBrand"

const FOOTER_SECTIONS = [
  {
    title: "Транспорт",
    links: [
      { label: "Легковые", href: "/category/cars" },
      { label: "Мото", href: "/category/moto" },
      { label: "Грузовики", href: "/category/trucks" },
      { label: "Спецтехника", href: "/category/special" },
      { label: "Водный транспорт", href: "/category/water" },
      { label: "Воздушный транспорт", href: "/category/air" },
    ],
  },
  {
    title: "Запчасти",
    links: [
      { label: "Все запчасти", href: "/parts-finder" },
      { label: "Ходовая / Подвеска", href: "/parts-finder?partType=SUSPENSION" },
      { label: "Рулевое управление", href: "/parts-finder?partType=STEERING" },
      { label: "Тормоза", href: "/parts-finder?partType=BRAKES" },
      { label: "Электрика", href: "/parts-finder?partType=ELECTRICAL" },
      { label: "Оптика / Фары", href: "/parts-finder?partType=LIGHTING" },
      { label: "Двигатель", href: "/parts-finder?partType=ENGINE" },
      { label: "Кузов", href: "/parts-finder?partType=BODY" },
    ],
  },
  {
    title: "Сервисы",
    links: [
      { label: "Оценка стоимости", href: "/services/valuation" },
      { label: "Проверка истории", href: "/services/history-check" },
      { label: "Умный подбор", href: "/services/smart-matching" },
      { label: "Безопасная сделка", href: "/services/safe-deal" },
      { label: "Документы сделки", href: "/services/legal-documents" },
      { label: "Карта АЗС", href: "/services/fuel-map" },
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

const telegramBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "")
const SOCIALS = telegramBotUsername
  ? [{ icon: IconBrandTelegram, href: `https://t.me/${telegramBotUsername}`, label: "Telegram", color: "#0088cc" }]
  : []

export default function AppFooter() {
  return (
    <Box component="footer" className="market-app-footer" style={{
      background: "linear-gradient(180deg, #09090b 0%, #000000 100%)",
      borderTop: "3px solid #4f46e5",
      marginTop: 60,
    }}>
      <Container size="xl" py="xl">
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 5 }} spacing={{ base: "xl", md: "lg" }} verticalSpacing="xl">
            <Stack gap="sm" miw={0}>
              <LeWheelBrand size={42} tone="inverse" />
              <Text size="sm" c="#a1a1aa" lh={1.6}>
                Маркетплейс транспорта и запчастей с инструментами проверки, подбора и сопровождения.
              </Text>
              {SOCIALS.length > 0 && <Group gap={8}>
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
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon size={18} color={s.color} />
                    </ActionIcon>
                  )
                })}
              </Group>}
            </Stack>

            {FOOTER_SECTIONS.map((section) => (
              <Stack key={section.title} gap={8} miw={0}>
                  <Text size="xs" fw={800} c="#d4d4d8" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                    {section.title}
                  </Text>
                  {section.links.map((link) => (
                    <Anchor
                      key={link.href}
                      component={Link}
                      href={link.href}
                      size="sm"
                      c="#a1a1aa"
                      display="block"
                      style={{ lineHeight: 1.45, transition: "color 150ms ease" }}
                      styles={{ root: { overflowWrap: "anywhere" } }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff" }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#a1a1aa" }}
                    >
                      {link.label}
                    </Anchor>
                  ))}
              </Stack>
            ))}
          </SimpleGrid>

          <Divider color="#27272a" />

          {/* Нижняя секция */}
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Text size="xs" c="#52525b">© {new Date().getFullYear()} LeWheel</Text>
            <Group gap="lg" wrap="wrap">
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
