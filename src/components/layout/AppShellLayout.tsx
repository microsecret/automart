"use client"

import { useState } from "react"
import { Box, ScrollArea, NavLink, Text, Stack, Divider, Group, Badge, ThemeIcon, Anchor } from "@mantine/core"
import SupportChat from "@/components/support/SupportChat"
import {
  IconCar, IconMotorbike, IconTruck, IconTractor, IconSpeedboat, IconPlane,
  IconTools, IconBuildingStore, IconChevronDown, IconHeart, IconMessageCircle2,
  IconBell, IconAdjustmentsHorizontal, IconNews, IconHome2, IconSearch, IconPlus,
} from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import AppHeader from "./AppHeader"
import AppFooter from "./AppFooter"
import AppAnalytics from "@/components/analytics/AppAnalytics"

const CATEGORIES = [
  { slug: "cars", label: "Легковые", icon: <IconCar size={16} stroke={1.7} /> },
  { slug: "moto", label: "Мото", icon: <IconMotorbike size={16} stroke={1.7} /> },
  { slug: "trucks", label: "Грузовики", icon: <IconTruck size={16} stroke={1.7} /> },
  { slug: "special", label: "Спецтехника", icon: <IconTractor size={16} stroke={1.7} /> },
  { slug: "water", label: "Водный транспорт", icon: <IconSpeedboat size={16} stroke={1.7} /> },
  { slug: "air", label: "Воздушный транспорт", icon: <IconPlane size={16} stroke={1.7} /> },
]

const PARTS_LINKS = [
  { slug: "parts", label: "Все запчасти", href: "/parts-finder" },
  { label: "Двигатель", href: "/parts-finder?partType=ENGINE" },
  { label: "Тормоза", href: "/parts-finder?partType=BRAKES" },
  { label: "Подвеска / Ходовая", href: "/parts-finder?partType=SUSPENSION" },
  { label: "Рулевое управление", href: "/parts-finder?partType=STEERING" },
  { label: "Электрика", href: "/parts-finder?partType=ELECTRICAL" },
  { label: "Оптика / Фары", href: "/parts-finder?partType=LIGHTING" },
  { label: "Кузов", href: "/parts-finder?partType=BODY" },
  { label: "Колёса и диски", href: "/parts-finder?partType=WHEELS" },
  { label: "Охлаждение", href: "/parts-finder?partType=COOLING" },
]

const SERVICE_LINKS = [
  { label: "Оценка стоимости", href: "/services/valuation" },
  { label: "Проверка истории", href: "/services/history-check" },
  { label: "Умный подбор", href: "/services/smart-matching" },
  { label: "Безопасная сделка", href: "/services/safe-deal" },
]

const HELP_LINKS = [
  { label: "Как продать авто", href: "/help/sell" },
  { label: "Безопасность", href: "/help/safety" },
  { label: "Правила", href: "/help/rules" },
  { label: "Поддержка", href: "/help/support" },
]

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const activeCat = pathname?.startsWith("/category/") ? pathname.split("/")[2] : null
  const [expanded, setExpanded] = useState<string | null>(null)

  const toggle = (id: string) => setExpanded(expanded === id ? null : id)

  return (
    <Box style={{ minHeight: "100vh", background: "var(--mantine-color-body)" }}>
      <AppAnalytics />
      <AppHeader />

      <Box style={{ display: "flex", maxWidth: 1440, margin: "0 auto" }}>
        {/* Сайдбар */}
        <Box
          component="aside"
          className="app-sidebar"
          style={{
            width: 230,
            flexShrink: 0,
            position: "sticky",
            top: 56,
            height: "calc(100vh - 56px)",
            borderRight: "1px solid var(--mantine-color-border)",
            background: "var(--mantine-color-body)",
            overflow: "hidden",
          }}
        >
          <ScrollArea h="100%" type="hover" scrollbarSize={5}>
            <Stack gap={0} p="xs">
              {/* Транспорт */}
              <SectionLabel>Транспорт</SectionLabel>
              <Stack gap={1}>
                {CATEGORIES.map((cat) => {
                  const isActive = activeCat === cat.slug
                  return (
                    <NavLink
                      key={cat.slug}
                      component={Link}
                      href={`/category/${cat.slug}`}
                      label={cat.label}
                      leftSection={cat.icon}
                      active={isActive}
                      color="indigo"
                      radius="md"
                      py={6}
                      style={{ fontSize: "0.8125rem", fontWeight: isActive ? 600 : 500 }}
                    />
                  )
                })}
              </Stack>

              {/* Запчасти */}
              <SectionLabel mt="sm">Запчасти</SectionLabel>
              <Stack gap={1}>
                <NavLink
                  component={Link}
                  href="/parts-finder"
                  label="Все запчасти"
                  leftSection={<IconTools size={16} stroke={1.7} />}
                  active={activeCat === "parts"}
                  color="indigo"
                  radius="md"
                  py={6}
                  style={{ fontSize: "0.8125rem", fontWeight: activeCat === "parts" ? 600 : 500 }}
                />
                {PARTS_LINKS.slice(1).map((link) => (
                  <NavLink
                    key={link.label}
                    component={Link}
                    href={link.href}
                    label={link.label}
                    radius="sm"
                    py={4}
                    px="lg"
                    color="gray"
                    style={{ fontSize: "0.75rem", color: "var(--mantine-color-dimmed)" }}
                  />
                ))}
              </Stack>

              {/* Быстрые ссылки */}
      <SectionLabel mt="sm">Кабинет</SectionLabel>
      <Stack gap={1}>
        <Anchor component={Link} href="/dashboard" size="xs" c="gray.5" style={{ padding: "4px 10px", borderRadius: 6, textDecoration: "none" }}>
          📊 Личный кабинет
        </Anchor>
        <Anchor component={Link} href="/dashboard/deliveries" size="xs" c="gray.5" style={{ padding: "4px 10px", borderRadius: 6, textDecoration: "none" }}>
          🚚 Мои доставки
        </Anchor>
        <Anchor component={Link} href="/favorites" size="xs" c="gray.5" style={{ padding: "4px 10px", borderRadius: 6, textDecoration: "none" }}>
          ❤️ Избранное
        </Anchor>
        <Anchor component={Link} href="/compare" size="xs" c="gray.5" style={{ padding: "4px 10px", borderRadius: 6, textDecoration: "none" }}>
          ⚖️ Сравнение
        </Anchor>
        <Anchor component={Link} href="/messages" size="xs" c="gray.5" style={{ padding: "4px 10px", borderRadius: 6, textDecoration: "none" }}>
          💬 Сообщения
        </Anchor>
      </Stack>

      {/* Аукционы */}
      <SectionLabel mt="sm">Аукционы мира</SectionLabel>
      <Stack gap={1}>
        <Anchor component={Link} href="/auctions" size="sm" c="gray.6" style={{ padding: "6px 10px", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>
          🔨 Все аукционы
        </Anchor>
        <Anchor component={Link} href="/auctions?country=JP" size="xs" c="gray.5" style={{ padding: "4px 10px 4px 24px", borderRadius: 6, textDecoration: "none" }}>
          🇯🇵 Япония (USS, TAA)
        </Anchor>
        <Anchor component={Link} href="/auctions?country=KR" size="xs" c="gray.5" style={{ padding: "4px 10px 4px 24px", borderRadius: 6, textDecoration: "none" }}>
          🇰🇷 Корея (Emaraat, AJ)
        </Anchor>
        <Anchor component={Link} href="/auctions?country=US" size="xs" c="gray.5" style={{ padding: "4px 10px 4px 24px", borderRadius: 6, textDecoration: "none" }}>
          🇺🇸 США (Copart, IAAI)
        </Anchor>
        <Anchor component={Link} href="/auctions?country=CN" size="xs" c="gray.5" style={{ padding: "4px 10px 4px 24px", borderRadius: 6, textDecoration: "none" }}>
          🇨🇳 Китай (YCheZhai, Guazi)
        </Anchor>
        <Anchor component={Link} href="/auctions?country=DE" size="xs" c="gray.5" style={{ padding: "4px 10px 4px 24px", borderRadius: 6, textDecoration: "none" }}>
          🇩🇪 Европа (Mobile.de)
        </Anchor>
      </Stack>

      {/* Сервисы */}
              <SectionLabel mt="sm">Сервисы</SectionLabel>
              <Stack gap={1}>
                {SERVICE_LINKS.map((link) => (
                  <NavLink
                    key={link.label}
                    component={Link}
                    href={link.href}
                    label={link.label}
                    radius="sm"
                    py={5}
                    color="gray"
                    style={{ fontSize: "0.8125rem" }}
                  />
                ))}
              </Stack>

              {/* Помощь */}
              <SectionLabel mt="sm">Помощь</SectionLabel>
              <Stack gap={1} mb="sm">
                {HELP_LINKS.map((link) => (
                  <NavLink
                    key={link.label}
                    component={Link}
                    href={link.href}
                    label={link.label}
                    radius="sm"
                    py={5}
                    color="gray"
                    style={{ fontSize: "0.8125rem" }}
                  />
                ))}
              </Stack>

              <Divider color="gray.2" mb="xs" />

              {/* Быстрые ссылки */}
              <Stack gap={1}>
                <NavLink component={Link} href="/news" label="Новости" leftSection={<IconNews size={16} stroke={1.7} />} radius="sm" py={5} color="gray" style={{ fontSize: "0.8125rem" }} />
                <NavLink component={Link} href="/brands" label="Все марки" radius="sm" py={5} color="gray" style={{ fontSize: "0.8125rem" }} />
                <NavLink component={Link} href="/compare" label="Сравнение" radius="sm" py={5} color="gray" style={{ fontSize: "0.8125rem" }} />
              </Stack>
            </Stack>
          </ScrollArea>
        </Box>

        {/* Контент */}
        <Box component="main" className="app-main-content" style={{ flex: 1, minWidth: 0 }}>
          {children}
        </Box>
      </Box>

      <AppFooter />

      <style>{`
        @media (max-width: 900px) { .app-sidebar { display: none !important; } }
      `}</style>

      {/* Чат поддержки */}
      <SupportChat />

      <nav className="mobile-bottom-nav" aria-label="Основная навигация">
        <Link href="/" aria-label="Главная"><IconHome2 size={18} /><span>Главная</span></Link>
        <Link href="/search" aria-label="Поиск"><IconSearch size={18} /><span>Поиск</span></Link>
        <Link href="/listings/create/vehicle" aria-label="Разместить объявление" className="mobile-bottom-nav__accent"><IconPlus size={20} /><span>Продать</span></Link>
        <Link href="/favorites" aria-label="Избранное"><IconHeart size={18} /><span>Избранное</span></Link>
        <Link href="/messages" aria-label="Сообщения"><IconMessageCircle2 size={18} /><span>Чаты</span></Link>
      </nav>
    </Box>
  )
}

function SectionLabel({ children, mt }: { children: React.ReactNode; mt?: string }) {
  return (
    <Text
      size="10px"
      fw={700}
      c="gray.4"
      px="sm"
      mt={mt || 0}
      pb="xs"
      pt="xs"
      ff="var(--font-display), sans-serif"
      style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
    >
      {children}
    </Text>
  )
}
