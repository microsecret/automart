"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Box, Text } from "@mantine/core"
import { IconLayoutGrid, IconX } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import AuctionFlag from "@/components/sidebar/AuctionFlag"
import MiniArt from "./MiniArt"
import {
  CREATE_VEHICLE_HREF,
  TELEGRAM_MENU_NAVIGATION,
  TELEGRAM_TAB_NAVIGATION,
} from "@/lib/navigation-registry"

/**
 * Оболочка приложения Telegram: шапка, содержимое, нижняя панель и
 * шторка разделов.
 *
 * Устроена как приложение для iOS и Android, а не как страница со
 * ссылками: стеклянная шапка, плавающая панель вкладок под большим
 * пальцем, разделы — плитками в шторке снизу.
 *
 * Своя светлая палитра вместо темы мессенджера. Владелец попросил
 * светлое и сочное приложение; в тёмной теме Telegram прежняя лента
 * выглядела мрачно, а титановые значки на тёмном фоне терялись. Шапку и
 * подложку Telegram красим в те же цвета, чтобы на стыке не было шва.
 */

/* Цвета шапки и подложки Telegram — те же, что фон приложения в
   telegram.css. Платформа принимает только готовые значения, не
   переменные CSS. */
const APP_BG = "#f2f5f9"
const APP_SURFACE = "#ffffff"
const APP_ACCENT = "#0b7285"

/* Аукционы по странам показываются флажками, остальные разделы шторки —
   плитками с объёмными значками. */
const COUNTRY_SECTION = "Аукционы по странам"

const TABS = TELEGRAM_TAB_NAVIGATION

export default function TelegramShell({
  children,
  activeTab = "/telegram",
  title,
  subtitle,
  mainAction = true,
  signedIn = true,
}: {
  children: React.ReactNode
  activeTab?: string
  title: string
  subtitle?: string
  /** Показывать ли кнопку платформы «Разместить объявление». */
  mainAction?: boolean
  /* Прошёл ли человек вход.

     Главная кнопка ведёт на форму подачи, а она закрыта: без входа
     человек внутри Telegram упирался в форму почты и пароля, которых у
     него нет и быть не может — он пришёл из бота. Кнопка ждёт, пока
     вход завершится. */
  signedIn?: boolean
}) {
  const [ready, setReady] = useState(false)
  /* Непрочитанные сообщения и уведомления — для значков на вкладке и
     колокольчике. Тот же адрес, что у шапки сайта: запрос дорогой, и
     три места не должны дёргать его каждое по-своему. */
  const { data: shellStats } = useSWR<{ stats?: { unreadMessages?: number; unreadNotifications?: number } }>(
    "/api/dashboard/stats",
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 20_000 },
  )
  const unreadMessages = shellStats?.stats?.unreadMessages || 0
  const unreadNotifications = shellStats?.stats?.unreadNotifications || 0

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuMounted, setMenuMounted] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const openMenu = useCallback(() => {
    setMenuMounted(true)
    window.requestAnimationFrame(() => {
      setMenuOpen(true)
      closeButtonRef.current?.focus({ preventScroll: true })
    })
  }, [])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    menuButtonRef.current?.focus({ preventScroll: true })
  }, [])

  /* Шторка уезжает 300 мс — размонтируем после, иначе уход обрывается. */
  useEffect(() => {
    if (menuOpen || !menuMounted) return
    const timeout = window.setTimeout(() => setMenuMounted(false), 320)
    return () => window.clearTimeout(timeout)
  }, [menuMounted, menuOpen])

  /* Пока шторка открыта, страница под ней стоит.

     Палец по затемнению двигал ленту, и, закрыв меню, человек оказывался
     в другом месте ленты. Позиция запоминается и возвращается: фиксация
     страницы сама по себе отматывает её наверх. */
  useEffect(() => {
    if (!menuMounted) return

    const scrollY = window.scrollY
    const { body } = document
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }

    body.style.position = "fixed"
    body.style.top = `-${scrollY}px`
    body.style.width = "100%"
    body.style.overflow = "hidden"

    return () => {
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.width = previous.width
      body.style.overflow = previous.overflow
      window.scrollTo({ top: scrollY, behavior: "auto" })
    }
  }, [menuMounted])

  useEffect(() => {
    if (!menuMounted) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [closeMenu, menuMounted])

  useEffect(() => {
    /* Тема запоминается на сеанс: кабинет, объявление и форма подачи
       открываются обычными страницами сайта. Приложение теперь светлое,
       и страницы за ним тоже светлые — без вспышки тёмного кабинета
       после светлой ленты. Отдельный ключ и хранилище сеанса не трогают
       выбор темы на самом сайте. */
    try {
      sessionStorage.setItem("telegram-color-scheme", "light")
    } catch {
      // Приватный режим запрещает хранилище — тема просто не запомнится.
    }

    const webApp = window.Telegram?.WebApp
    if (!webApp) {
      setReady(true)
      return
    }

    webApp.ready?.()
    webApp.expand?.()
    /* Свайп вниз закрывает приложение — при прокрутке ленты это
       происходит случайно и раздражает. */
    webApp.disableVerticalSwipes?.()
    webApp.setHeaderColor?.(APP_BG)
    webApp.setBackgroundColor?.(APP_BG)
    webApp.setBottomBarColor?.(APP_SURFACE)
    setReady(true)

    /* Кнопка платформы зовёт разместить объявление: она всегда внизу
       экрана во всю ширину — заметнее любой ссылки в ленте. */
    if (mainAction === false || !signedIn) {
      webApp.MainButton?.hide()
      return
    }

    const openCreate = () => {
      webApp.HapticFeedback?.impactOccurred("medium")
      window.location.assign(`${CREATE_VEHICLE_HREF}?source=telegram`)
    }

    webApp.MainButton?.setParams?.({
      text: "Разместить объявление",
      color: APP_ACCENT,
      text_color: "#ffffff",
      is_visible: true,
      /* Блик по кнопке — с версии 7.10; старые клиенты поле пропускают. */
      has_shine_effect: true,
    })
    webApp.MainButton?.setText("Разместить объявление")
    webApp.MainButton?.onClick(openCreate)
    webApp.MainButton?.show()

    return () => {
      webApp.MainButton?.offClick(openCreate)
      webApp.MainButton?.hide()
    }
  }, [mainAction, signedIn])

  /* Высота шапки нужна полю поиска: оно липнет под неё. Числом её не
     задать — подпись бывает в одну строку и в две. */
  const headRef = useRef<HTMLDivElement>(null)

  /* Кнопка «назад» платформы. На корневой ленте не нужна: возвращаться
     оттуда некуда, и лишняя стрелка предлагала бы выйти из приложения. */
  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    const backButton = webApp?.BackButton
    if (!backButton) return

    const isRoot = activeTab === "/telegram"
    const goBack = () => {
      webApp?.HapticFeedback?.impactOccurred("light")
      window.history.back()
    }

    if (isRoot) {
      backButton.hide()
      return
    }

    backButton.onClick(goBack)
    backButton.show()
    return () => {
      backButton.offClick(goBack)
      backButton.hide()
    }
  }, [activeTab])

  useEffect(() => {
    const head = headRef.current
    if (!head) return

    const apply = () => {
      document.documentElement.style.setProperty("--tg-head-height", `${Math.round(head.getBoundingClientRect().height)}px`)
    }
    apply()

    const observer = new ResizeObserver(apply)
    observer.observe(head)
    return () => observer.disconnect()
  }, [title, subtitle])

  return (
    <Box
      className="tg-shell"
      data-ready={ready || undefined}
      /* Панель вкладок стоит над главной кнопкой Telegram, а когда
         кнопки нет — опускается к нижнему краю. */
      data-main-button={mainAction === false || !signedIn ? "hidden" : undefined}
    >
      <Box className="tg-shell__head" ref={headRef}>
        <Link href="/telegram" className="tg-shell__brand" aria-label="LeWheel — свежие объявления">
          {/* eslint-disable-next-line @next/next/no-img-element -- знак 128 пикселей, оптимизатор не нужен */}
          <img src="/images/telegram/mark-128.webp" width={36} height={36} alt="" aria-hidden="true" />
        </Link>

        <Box className="tg-shell__heading">
          <Text className="tg-shell__title">{title}</Text>
          {subtitle && <Text className="tg-shell__subtitle">{subtitle}</Text>}
        </Box>

        <Link
          href="/notifications?from=telegram"
          className="tg-shell__icon-button"
          aria-label={unreadNotifications > 0 ? `Уведомления: ${unreadNotifications} новых` : "Уведомления"}
          onClick={() => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")}
        >
          <MiniArt kind="notifications" size={24} />
          {unreadNotifications > 0 && <span className="tg-dot" aria-hidden="true" />}
        </Link>

        <button
          ref={menuButtonRef}
          type="button"
          className="tg-shell__icon-button"
          onClick={() => {
            window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")
            openMenu()
          }}
          aria-label="Все разделы"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
        >
          <IconLayoutGrid size={20} stroke={1.9} />
        </button>
      </Box>

      {/* Шторка разделов.

          Выезжающее слева меню было списком мелкого текста, где у части
          строк не было значков, а у выбранной белая надпись стояла на
          голубом и не читалась. Шторка снизу — привычный жест iOS и
          Android, и до неё дотягивается большой палец. */}
      {menuMounted && (
        <>
          <Box className="tg-sheet__backdrop" data-open={menuOpen || undefined} onClick={closeMenu} aria-hidden="true" />
          <Box
            className="tg-sheet"
            data-open={menuOpen || undefined}
            role="dialog"
            aria-modal="true"
            aria-label="Все разделы"
          >
            <span className="tg-sheet__grabber" aria-hidden="true" />
            <Box className="tg-sheet__head">
              <Text className="tg-sheet__title">Все разделы</Text>
              <button ref={closeButtonRef} type="button" className="tg-sheet__close" onClick={closeMenu} aria-label="Закрыть">
                <IconX size={18} />
              </button>
            </Box>

            <Box className="tg-sheet__scroll">
              {TELEGRAM_MENU_NAVIGATION.map((section) => (
                <Box key={section.title} component="nav" className="tg-sheet__section" aria-label={section.title}>
                  <Text className="tg-sheet__section-title">{section.title}</Text>
                  {section.title === COUNTRY_SECTION ? (
                    <Box className="tg-sheet__countries">
                      {section.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="tg-sheet__country"
                          onClick={() => {
                            window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.()
                            closeMenu()
                          }}
                        >
                          <AuctionFlag country={item.id} />
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </Box>
                  ) : (
                    <Box className="tg-sheet__grid">
                      {section.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="tg-sheet__tile"
                          data-active={item.href === activeTab || undefined}
                          aria-current={item.href === activeTab ? "page" : undefined}
                          onClick={() => {
                            window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.()
                            closeMenu()
                          }}
                        >
                          <span className="tg-sheet__tile-art"><MiniArt kind={item.id} size={40} /></span>
                          <span className="tg-sheet__tile-label">{item.label}</span>
                        </Link>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        </>
      )}

      <Box className="tg-shell__body">{children}</Box>

      {/* Плавающая панель вкладок со стеклом — как в iOS 26 и Material 3:
          объёмные значки вместо контурных, выбранная вкладка — на
          подложке, которая въезжает пружиной. */}
      <Box component="nav" className="tg-nav" aria-label="Разделы приложения">
        {TABS.map(({ id, href, label }) => {
          const active = href === activeTab
          return (
            <Link
              key={href}
              href={href}
              className="tg-nav__item"
              data-active={active || undefined}
              onClick={() => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")}
              aria-current={active ? "page" : undefined}
            >
              <Box className="tg-nav__icon">
                <MiniArt kind={id} size={28} />
                {/* Непрочитанные видно, не заходя в переписку. */}
                {href.includes("tab=chats") && unreadMessages > 0 && (
                  <span className="tg-nav__badge">{unreadMessages > 9 ? "9+" : unreadMessages}</span>
                )}
              </Box>
              <Text component="span" className="tg-nav__label">{label}</Text>
            </Link>
          )
        })}
      </Box>
    </Box>
  )
}
