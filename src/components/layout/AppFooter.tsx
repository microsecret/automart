"use client"

import { Box, Text, Group, Stack, Container, Divider, Anchor, ActionIcon, SimpleGrid } from "@mantine/core"
import Link from "next/link"
import { IconBrandTelegram } from "@tabler/icons-react"
import LeWheelBrand from "@/components/brand/LeWheelBrand"

const FOOTER_SECTIONS = [
  {
    title: "Каталог",
    links: [
      /* Категории транспорта отсюда убраны: девять ссылок дословно
         повторяли боковое меню и плитки главной, вытягивая подвал втрое.
         Здесь остаются страницы, которых нет ни там, ни там. */
      { label: "Все объявления", href: "/" },
      { label: "Все марки", href: "/brands" },
      { label: "Карта объявлений", href: "/map" },
      { label: "Сравнение", href: "/compare" },
      { label: "Мировые аукционы", href: "/auctions" },
    ],
  },
  {
    title: "Запчасти",
    links: [
      { label: "Все запчасти", href: "/parts-finder" },
      { label: "Двигатель", href: "/parts-finder?partType=ENGINE" },
      { label: "Тормоза", href: "/parts-finder?partType=BRAKES" },
      { label: "Ходовая / Подвеска", href: "/parts-finder?partType=SUSPENSION" },
      { label: "Электрика", href: "/parts-finder?partType=ELECTRICAL" },
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
    // Ровная тёмная поверхность с тонкой линией сверху.
    //
    // Раньше подвал заливал градиент в чистый чёрный, поверх шла синяя рамка
    // и внутреннее свечение — три приёма ради одной задачи «отделить». Тёмный
    // тон и так отделяет подвал от светлой страницы, а свечение читалось как
    // засветка на стыке.
    //
    // Цвет — не чистый #000: замеры премиальных сайтов показывают, что чёрный
    // используют только как фон тёмной темы, но не как поверхность.
    <Box component="footer" className="market-app-footer" style={{
      background: "#0f1117",
      borderTop: "1px solid rgba(255, 255, 255, 0.08)",
      marginTop: 60,
    }}>
      <Container size="xl" py="xl">
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 2, xs: 3, md: 4, lg: 5 }} spacing={{ base: "lg", md: "md" }} verticalSpacing="md" className="market-app-footer__grid">
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
              <Stack key={section.title} gap={6} miw={0}>
                  <Text size="xs" fw={800} c="#d4d4d8" tt="uppercase" style={{ letterSpacing: "var(--track-caps)" }}>
                    {section.title}
                  </Text>
                  {section.links.map((link) => (
                    <Anchor
                      key={link.href}
                      component={Link}
                      href={link.href}
                      /* Код раздела не загружается заранее.

                         Подвал стоит на каждой странице и ведёт в три десятка
                         разделов. Next по умолчанию подтягивает код каждого,
                         поэтому на любой странице оказывались карта АЗС (47 КБ)
                         и документы сделки (29 КБ) — замер показал полтора
                         мегабайта скриптов, включая чужие разделы.

                         Ссылки подвала нажимают редко: экономия на загрузке
                         важнее мгновенного перехода. */
                      prefetch={false}
                      size="sm"
                      c="#a1a1aa"
                      display="block"
                      className="market-app-footer__link"
                      style={{ lineHeight: 1.45 }}
                      styles={{ root: { overflowWrap: "anywhere" } }}
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
            {/* Копирайт и нижние ссылки были #52525b и #71717a — контраст 2.6
                и 4.1 на чёрной подложке, ниже нормы WCAG AA. Ссылки к тому же
                шли тремя разными оттенками, хотя это один уровень навигации. */}
            <Text size="xs" c="#8a8a94">© {new Date().getFullYear()} LeWheel</Text>
            <Group gap="lg" wrap="wrap">
              <Anchor component={Link} href="/about" prefetch={false} size="xs" c="#a1a1aa">О проекте</Anchor>
              <Anchor component={Link} href="/news" prefetch={false} size="xs" c="#a1a1aa">Новости</Anchor>
              <Anchor component={Link} href="/legal/privacy" prefetch={false} size="xs" c="#a1a1aa">Конфиденциальность</Anchor>
              <Anchor component={Link} href="/legal/terms" prefetch={false} size="xs" c="#a1a1aa">Условия</Anchor>
            </Group>
          </Group>
        </Stack>
      </Container>
    </Box>
  )
}
