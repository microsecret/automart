"use client"

import { Container, Group, Text, Stack, Anchor, Box, Divider } from "@mantine/core"
import Link from "next/link"

const FOOTER_SECTIONS = [
  {
    title: "Транспорт",
    links: [
      { label: "Легковые", href: "/category/cars" },
      { label: "Мото", href: "/category/moto" },
      { label: "Грузовики", href: "/category/trucks" },
      { label: "Спецтехника", href: "/category/special" },
      { label: "Водный транспорт", href: "/category/water" },
    ],
  },
  {
    title: "Запчасти",
    links: [
      { label: "Все запчасти", href: "/category/parts" },
      { label: "Двигатель", href: "/search?type=part&partType=ENGINE" },
      { label: "Кузов", href: "/search?type=part&partType=BODY" },
      { label: "Подвеска", href: "/search?type=part&partType=SUSPENSION" },
      { label: "Колёса и диски", href: "/search?type=part&partType=WHEELS" },
    ],
  },
  {
    title: "Сервисы",
    links: [
      { label: "Оценка стоимости", href: "/ai/valuation" },
      { label: "Проверка истории", href: "/ai/history-check" },
      { label: "Умный подбор", href: "/ai/smart-matching" },
      { label: "Безопасная сделка", href: "/help/safe-deal" },
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

export default function AppFooter() {
  return (
    <Box
      component="footer"
      style={{
        background: "#09090b",
        borderTop: "1px solid #18181b",
        marginTop: 60,
      }}
    >
      <Container size="xl" py="xl">
        <Group
          justify="space-between"
          align="flex-start"
          gap={{ base: "xl", md: "xl" }}
          wrap="wrap"
        >
          {/* Бренд */}
          <Stack gap={8} maw={240}>
            <Text
              ff="var(--font-display), sans-serif"
              fw={800}
              fz={20}
              c="white"
              style={{ letterSpacing: "-0.02em" }}
            >
              Авторынок
            </Text>
            <Text size="xs" c="#52525b" lh={1.6}>
              Маркетплейс транспорта и запчастей с проверкой истории,
              безопасной сделкой и умным подбором.
            </Text>
          </Stack>

          {/* Колонки ссылок */}
          <Group gap={{ base: 32, md: 56 }} align="flex-start" wrap="wrap">
            {FOOTER_SECTIONS.map((section) => (
              <Stack key={section.title} gap={10}>
                <Text
                  size="xs"
                  fw={700}
                  c="#a1a1aa"
                  ff="var(--font-display), sans-serif"
                  style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
                >
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
                  >
                    {link.label}
                  </Anchor>
                ))}
              </Stack>
            ))}
          </Group>
        </Group>

        <Divider my="lg" color="#18181b" />

        <Group justify="space-between" wrap="nowrap">
          <Text size="xs" c="#52525b">
            © {new Date().getFullYear()} Авторынок
          </Text>
          <Group gap="lg">
            <Anchor size="xs" c="#52525b" component={Link} href="/about">О проекте</Anchor>
            <Anchor size="xs" c="#52525b" component={Link} href="/news">Новости</Anchor>
            <Anchor size="xs" c="#52525b" component={Link} href="/legal/privacy">Конфиденциальность</Anchor>
            <Anchor size="xs" c="#52525b" component={Link} href="/legal/terms">Условия</Anchor>
          </Group>
        </Group>
      </Container>
    </Box>
  )
}
