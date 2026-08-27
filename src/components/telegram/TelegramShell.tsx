"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Box, Text } from "@mantine/core"
import type { TelegramThemeParams } from "@/lib/telegram-webapp"
import {
  IconCar,
  IconFileDescription,
  IconGavel,
  IconHeart,
  IconList,
  IconMenu2,
  IconMessageCircle2,
  IconMessages,
  IconNews,
  IconPlus,
  IconTool,
  IconTruckDelivery,
  IconX,
  IconUser,
} from "@tabler/icons-react"
import {
  CREATE_VEHICLE_HREF,
  TELEGRAM_MENU_NAVIGATION,
  TELEGRAM_TAB_NAVIGATION,
} from "@/lib/navigation-registry"

/**
 * Оболочка приложения Telegram: шапка, лента и нижняя навигация.
 *
 * Приложение выглядело как страница со ссылками. Здесь оно устроено как
 * мобильное приложение: содержимое во весь экран, навигация внизу под
 * большим пальцем, оформление совпадает с темой мессенджера.
 *
 * Цвета берутся из переменных платформы (themeParams). Так приложение
 * выглядит родным и в светлой теме, и в тёмной, и у тех, кто поставил
 * свою: чужеродная белая страница внутри тёмного Telegram — первое, что
 * выдаёт наспех сделанное приложение.
 */

/* Запасные цвета — на случай, если платформа их не отдала.

   Подобраны под тёмное оформление Telegram по умолчанию: приложение,
   открытое в старом клиенте, не должно вспыхивать белым. */
const FALLBACK: Required<Pick<TelegramThemeParams,
  "bg_color" | "secondary_bg_color" | "text_color" | "hint_color" | "link_color"
  | "button_color" | "button_text_color" | "section_bg_color" | "section_separator_color"
>> = {
  bg_color: "#17212b",
  secondary_bg_color: "#0e1621",
  text_color: "#ffffff",
  hint_color: "#708499",
  link_color: "#6ab3f3",
  button_color: "#5288c1",
  button_text_color: "#ffffff",
  section_bg_color: "#17212b",
  section_separator_color: "#101921",
}

/* Разделы выезжающего меню.

   Прежде здесь был ряд вкладок под заголовком, но он повторял нижнюю
   навигацию — четыре подписи из пяти совпадали. Толку от такого дубля
   нет, а место он занимал.

   Меню открывается кнопкой слева вверху, как в мобильной версии сайта, и
   вмещает то, чему не нашлось места внизу: личные разделы, запчасти,
   аукционы по странам. */
const MENU_ICONS: Record<string, typeof IconCar | null> = {
  vehicles: IconCar,
  auctions: IconGavel,
  news: IconNews,
  parts: IconTool,
  favorites: IconHeart,
  messages: IconMessageCircle2,
  listings: IconList,
  garage: IconCar,
  deliveries: IconTruckDelivery,
  documents: IconFileDescription,
}

const TAB_ICONS = {
  vehicles: IconCar,
  auctions: IconGavel,
  create: IconPlus,
  forum: IconMessages,
  profile: IconUser,
} satisfies Record<(typeof TELEGRAM_TAB_NAVIGATION)[number]["id"], typeof IconCar>

const MENU_SECTIONS = TELEGRAM_MENU_NAVIGATION.map((section) => ({
  ...section,
  items: section.items.map((item) => ({ ...item, Icon: MENU_ICONS[item.id] || null })),
}))

const TABS = TELEGRAM_TAB_NAVIGATION.map((item) => ({
  ...item,
  Icon: TAB_ICONS[item.id],
  accent: item.id === "create",
}))

export default function TelegramShell({
  children,
  activeTab = "/telegram",
  title,
  subtitle,
  mainAction = true,
}: {
  children: React.ReactNode
  activeTab?: string
  title: string
  subtitle?: string
  /** Показывать ли кнопку платформы «Разместить объявление». */
  mainAction?: boolean
}) {
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuMounted, setMenuMounted] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const openMenu = useCallback(() => {
    setMenuMounted(true)
    window.requestAnimationFrame(() => setMenuOpen(true))
  }, [])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    menuButtonRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (menuOpen || !menuMounted) return
    const timeout = window.setTimeout(() => setMenuMounted(false), 220)
    return () => window.clearTimeout(timeout)
  }, [menuMounted, menuOpen])

  useEffect(() => {
    if (!menuMounted) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [closeMenu, menuMounted])

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) {
      // Открыто в обычном браузере: запасная тема уже задана в стилях.
      setReady(true)
      return
    }

    webApp.ready?.()
    webApp.expand?.()
    /* Свайп вниз закрывает приложение — при прокрутке ленты это
       происходит случайно и раздражает. Отключаем там, где платформа
       позволяет. */
    webApp.disableVerticalSwipes?.()

    const theme = webApp.themeParams || {}
    const root = document.documentElement
    for (const [key, fallback] of Object.entries(FALLBACK)) {
      const value = theme[key as keyof TelegramThemeParams] || fallback
      root.style.setProperty(`--tg-${key.replace(/_/g, "-")}`, value)
    }
    /* Короткие имена для стилей: полные названия платформы длинны и
       читаются хуже в правилах. */
    root.style.setProperty("--tg-bg", theme.bg_color || FALLBACK.bg_color)
    root.style.setProperty("--tg-surface", theme.section_bg_color || theme.bg_color || FALLBACK.section_bg_color)
    root.style.setProperty("--tg-elevated", theme.secondary_bg_color || FALLBACK.secondary_bg_color)
    root.style.setProperty("--tg-text", theme.text_color || FALLBACK.text_color)
    root.style.setProperty("--tg-hint", theme.hint_color || FALLBACK.hint_color)
    root.style.setProperty("--tg-accent", theme.button_color || FALLBACK.button_color)
    root.style.setProperty("--tg-accent-text", theme.button_text_color || FALLBACK.button_text_color)
    root.style.setProperty("--tg-line", theme.section_separator_color || FALLBACK.section_separator_color)

    /* Тема мессенджера сохраняется для остального сайта.

       Кабинет, объявление и форма подачи открываются как обычные
       страницы, и скрипта Telegram там нет: человек с тёмным
       мессенджером переходил из тёмной ленты в белый кабинет.

       Значение живёт в том же ключе, что и выбор темы на сайте, —
       переход внутри приложения ничем не отличается от переключения
       темы вручную. */
    try {
      const scheme = webApp.colorScheme === "dark" ? "dark" : "light"
      localStorage.setItem("automart-color-scheme", scheme)
    } catch {
      // Приватный режим запрещает хранилище — тема просто не запомнится.
    }

    webApp.setHeaderColor?.(theme.bg_color || FALLBACK.bg_color)
    webApp.setBackgroundColor?.(theme.secondary_bg_color || FALLBACK.secondary_bg_color)
    setReady(true)

    /* Кнопка платформы зовёт разместить объявление.

       Это самое заметное место в приложении: она всегда внизу экрана, во
       всю ширину, цветом мессенджера — ссылка в ленте с ней не
       сравнится. Приложение и делается ради того, чтобы машины
       выкладывали отсюда.

       На вкладке подачи её нет: звать туда, где человек уже находится,
       незачем. */
    if (mainAction === false) {
      webApp.MainButton?.hide()
      return
    }

    const openCreate = () => {
      webApp.HapticFeedback?.impactOccurred("medium")
      window.location.assign(`${CREATE_VEHICLE_HREF}?source=telegram`)
    }

    webApp.MainButton?.setParams?.({
      text: "Разместить объявление",
      color: theme.button_color || FALLBACK.button_color,
      text_color: theme.button_text_color || FALLBACK.button_text_color,
      is_visible: true,
    })
    webApp.MainButton?.setText("Разместить объявление")
    webApp.MainButton?.onClick(openCreate)
    webApp.MainButton?.show()

    return () => {
      webApp.MainButton?.offClick(openCreate)
      webApp.MainButton?.hide()
    }
  }, [mainAction])

  /* Высота шапки нужна полю поиска: оно липнет под неё.

     Числом её не задать — подпись бывает в одну строку и в две, а на
     узком экране заголовок переносится. Замер показал 67 пикселей там,
     где предполагалось 64, и верх поля прятался под шапкой. */
  const headRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const head = headRef.current
    if (!head) return

    const apply = () => {
      document.documentElement.style.setProperty("--tg-head-height", `${Math.round(head.getBoundingClientRect().height)}px`)
    }
    apply()

    // Высота меняется при повороте экрана и смене раздела.
    const observer = new ResizeObserver(apply)
    observer.observe(head)
    return () => observer.disconnect()
  }, [title, subtitle])

  return (
    <Box className="tg-shell" data-ready={ready || undefined}>
      <Box className="tg-shell__head" ref={headRef}>
        {/* Кнопка меню слева, как в мобильной версии сайта. */}
        <button
          ref={menuButtonRef}
          type="button"
          className="tg-shell__menu-button"
          onClick={() => {
            window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")
            openMenu()
          }}
          aria-label="Открыть меню"
          aria-expanded={menuOpen}
        >
          <IconMenu2 size={20} />
        </button>

        <Box className="tg-shell__heading">
          <Text className="tg-shell__title">{title}</Text>
          {subtitle && <Text className="tg-shell__subtitle">{subtitle}</Text>}
        </Box>
      </Box>

      {/* Выезжающее меню.

          Прежде здесь был ряд вкладок, повторявший нижнюю навигацию.
          Меню вмещает то, чему не нашлось места внизу, и приходит сбоку —
          так видно, откуда оно и куда уйдёт. */}
      {menuMounted && (
        <>
          <Box
            className="tg-menu__backdrop"
            data-open={menuOpen || undefined}
            onClick={closeMenu}
            aria-hidden="true"
          />
          <Box component="nav" className="tg-menu" data-open={menuOpen || undefined} aria-label="Разделы" aria-hidden={!menuOpen}>
            <Box className="tg-menu__head">
              <Text className="tg-menu__brand">LeWheel</Text>
              <button
                type="button"
                className="tg-menu__close"
                onClick={closeMenu}
                tabIndex={menuOpen ? undefined : -1}
                aria-label="Закрыть меню"
              >
                <IconX size={18} />
              </button>
            </Box>

            {MENU_SECTIONS.map((section) => (
              <Box key={section.title} className="tg-menu__section">
                <Text className="tg-menu__section-title">{section.title}</Text>
                {section.items.map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="tg-menu__item"
                    data-active={href === activeTab || undefined}
                    onClick={() => {
                      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.()
                      closeMenu()
                    }}
                    tabIndex={menuOpen ? undefined : -1}
                  >
                    {Icon ? <Icon size={18} stroke={1.8} /> : <span className="tg-menu__flag" />}
                    <span>{label}</span>
                  </Link>
                ))}
              </Box>
            ))}
          </Box>
        </>
      )}

      <Box className="tg-shell__body">{children}</Box>

      <Box component="nav" className="tg-nav" aria-label="Разделы приложения">
        {TABS.map(({ href, label, Icon, accent }) => {
          const active = href === activeTab
          return (
            <Link
              key={href}
              href={href}
              className="tg-nav__item"
              data-active={active || undefined}
              data-accent={accent || undefined}
              onClick={() => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={accent ? 21 : 19} stroke={active ? 2.2 : 1.8} />
              <Text component="span" className="tg-nav__label">{label}</Text>
            </Link>
          )
        })}
      </Box>
    </Box>
  )
}
