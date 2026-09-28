"use client"

import { Box, Text, Group, Stack, Container, Anchor, SimpleGrid } from "@mantine/core"
import Link from "next/link"
import { IconBrandTelegram, IconPlus } from "@tabler/icons-react"
import LeWheelBrand from "@/components/brand/LeWheelBrand"
import { CREATE_VEHICLE_HREF, FOOTER_NAVIGATION } from "@/lib/navigation-registry"

const FOOTER_SECTIONS = FOOTER_NAVIGATION.map((section) => ({ ...section, links: section.items }))

const telegramBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "")

export default function AppFooter() {
  return (
    /* Подвал — тёмная плита на всю ширину окна, как у площадки-образца.

       Светлый подвал «в тоне страницы» сливался с контентом над ним: владелец
       не видел, где кончается сайт, и назвал его недоделанным. Тёмная плита
       закрывает страницу явно, а боковые колонки обрываются над ней —
       AppShellLayout укорачивает их, когда подвал входит в кадр.

       Сверху — две карточки действия: подать объявление и открыть бота. */
    <Box component="footer" className="market-app-footer">
      <Container size="xl">
        <Stack gap={0}>
          {/* Две карточки, у каждой свой смысл.

              Было: «Продаёте машину или запчасть?» и рядом две кнопки —
              «Подать объявление» и «Бот в Telegram». Бот к продаже отношения
              не имеет, и владелец спросил, зачем он под этим вопросом.
              Теперь бот стоит отдельно и говорит, что он даёт: цены на
              заправках, наличие топлива, уведомления. */}
          <Box className="market-app-footer__cta">
            <Box className="market-app-footer__cta-card">
              <span className="market-app-footer__cta-icon" aria-hidden="true"><IconPlus size={20} stroke={2} /></span>
              <Box className="market-app-footer__cta-body">
                <Text className="market-app-footer__cta-title">Продайте машину или запчасть</Text>
                <Text className="market-app-footer__cta-text">Бесплатно. После проверки объявление появится в каталоге и в городском чате Telegram.</Text>
              </Box>
              <Anchor component={Link} href={CREATE_VEHICLE_HREF} prefetch={false} className="market-app-footer__btn market-app-footer__btn--primary">
                Подать объявление
              </Anchor>
            </Box>
            {telegramBotUsername && (
              <Box className="market-app-footer__cta-card">
                <span className="market-app-footer__cta-icon market-app-footer__cta-icon--tg" aria-hidden="true"><IconBrandTelegram size={20} stroke={1.8} /></span>
                <Box className="market-app-footer__cta-body">
                  <Text className="market-app-footer__cta-title">Бот LeWheel в Telegram</Text>
                  <Text className="market-app-footer__cta-text">Цены на заправках рядом, наличие топлива и ответы по вашим объявлениям — в одном чате.</Text>
                </Box>
                <Anchor href={`https://t.me/${telegramBotUsername}`} target="_blank" rel="noreferrer" className="market-app-footer__btn">
                  Открыть бота
                </Anchor>
              </Box>
            )}
          </Box>

          {/* Бренд отдельной колонкой, разделы — сеткой. Бренд шире прочих
              колонок: под ним описание площадки, и в узкой колонке оно
              ломалось на пять строк по два слова. */}
          <Box className="market-app-footer__top">
            <Stack gap={14} className="market-app-footer__brand">
              <LeWheelBrand size={36} tone="inverse" idSuffix="-footer" />
              <Text className="market-app-footer__tagline">
                Маркетплейс транспорта и запчастей: объявления по России, лоты мировых аукционов,
                проверка истории и цены на заправках.
              </Text>
            </Stack>

            <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing={{ base: "lg", md: "xl" }} verticalSpacing="lg" className="market-app-footer__grid">
              {FOOTER_SECTIONS.map((section) => (
                <Stack key={section.title} gap={12} miw={0}>
                  <Text component="h3" className="market-app-footer__heading">
                    {section.title}
                  </Text>
                  <Stack gap={8}>
                    {section.links.map((link) => (
                      <Anchor
                        key={link.href}
                        component={Link}
                        href={link.href}
                        /* Код раздела не загружается заранее: подвал стоит на
                           каждой странице и ведёт в три десятка разделов, а
                           нажимают его ссылки редко. */
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

          <Group justify="space-between" align="center" wrap="wrap" gap="md" className="market-app-footer__bottom">
            <Text className="market-app-footer__copy">© {new Date().getFullYear()} LeWheel · маркетплейс транспорта и запчастей</Text>
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
