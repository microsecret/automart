"use client"

import { Box, Text, Group, Stack, Container, Anchor, ActionIcon, SimpleGrid } from "@mantine/core"
import Link from "next/link"
import { IconBrandTelegram } from "@tabler/icons-react"
import LeWheelBrand from "@/components/brand/LeWheelBrand"
import { FOOTER_NAVIGATION } from "@/lib/navigation-registry"

const FOOTER_SECTIONS = FOOTER_NAVIGATION.map((section) => ({ ...section, links: section.items }))

const telegramBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "")
const SOCIALS = telegramBotUsername
  ? [{ icon: IconBrandTelegram, href: `https://t.me/${telegramBotUsername}`, label: "Telegram", color: "#0088cc" }]
  : []

export default function AppFooter() {
  return (
    /* Подвал в тоне страницы, а не чёрная плита под ней.
     *
     * Он был залит #0f1117 — почти чёрным. На светлой странице это читалось
     * как обрыв: белый лист заканчивался, начинался другой сайт. Тон
     * подвала теперь родня фону страницы, на полтона глубже, и отделяет
     * его линия, а не смена освещения.
     *
     * Заодно это чинит ссылки: на чёрном они шли серым #a1a1aa, и каждый
     * оттенок приходилось подбирать отдельно от остального сайта. Теперь
     * подвал берёт те же переменные текста, что и страницы над ним. */
    <Box component="footer" className="market-app-footer">
      <Container size="xl">
        <Stack gap={0}>
          {/* Верхняя часть: бренд отдельной колонкой, разделы — сеткой.
              Бренд шире прочих колонок: под ним описание площадки, и в
              узкой колонке оно ломалось на пять строк по два слова. */}
          <Box className="market-app-footer__top">
            <Stack gap={14} className="market-app-footer__brand">
              <LeWheelBrand size={40} />
              <Text className="market-app-footer__tagline">
                Маркетплейс транспорта и запчастей: объявления по России, лоты мировых аукционов,
                проверка истории и цены на заправках.
              </Text>
              {SOCIALS.length > 0 && (
                <Group gap={8}>
                  {SOCIALS.map((s) => {
                    const Icon = s.icon
                    return (
                      <ActionIcon
                        key={s.label}
                        component="a"
                        href={s.href}
                        size={38}
                        variant="default"
                        className="market-app-footer__social"
                        aria-label={s.label}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon size={19} />
                      </ActionIcon>
                    )
                  })}
                </Group>
              )}
            </Stack>

            <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing={{ base: "lg", md: "xl" }} verticalSpacing="lg" className="market-app-footer__grid">
              {FOOTER_SECTIONS.map((section) => (
                <Stack key={section.title} gap={10} miw={0}>
                  <Text component="h3" className="market-app-footer__heading">
                    {section.title}
                  </Text>
                  <Stack gap={8}>
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
                        className="market-app-footer__link"
                      >
                        {link.label}
                      </Anchor>
                    ))}
                  </Stack>
                </Stack>
              ))}
            </SimpleGrid>
          </Box>

          {/* Нижняя строка: копирайт и правовые ссылки.
              Отделена линией, а не пустотой — иначе она висит в воздухе
              и читается как ещё одна колонка навигации. */}
          <Group justify="space-between" align="center" wrap="wrap" gap="md" className="market-app-footer__bottom">
            <Text className="market-app-footer__copy">© {new Date().getFullYear()} LeWheel</Text>
            <Group gap={20} wrap="wrap">
              <Anchor component={Link} href="/about" prefetch={false} className="market-app-footer__legal">О проекте</Anchor>
              <Anchor component={Link} href="/news" prefetch={false} className="market-app-footer__legal">Новости</Anchor>
              <Anchor component={Link} href="/legal/privacy" prefetch={false} className="market-app-footer__legal">Конфиденциальность</Anchor>
              <Anchor component={Link} href="/legal/terms" prefetch={false} className="market-app-footer__legal">Условия</Anchor>
            </Group>
          </Group>
        </Stack>
      </Container>
    </Box>
  )
}
