/**
 * Платформа Telegram Mini Apps: то, чем мы пользуемся.
 *
 * Тип объявлялся внутри компонента приветствия и знал только про вход.
 * Приложению нужно больше — тема оформления, жесты, отклик, — и держать
 * это описание в одном месте надёжнее: иначе два компонента разойдутся в
 * том, что считают доступным.
 *
 * Все поля необязательные намеренно. Клиенты Telegram обновляются
 * вразнобой, и возможность, появившаяся в версии 7.7, у части людей
 * просто отсутствует: вызывать её нужно через `?.`, а не проверять
 * версию вручную.
 */

export type TelegramThemeParams = {
  bg_color?: string
  secondary_bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  section_bg_color?: string
  section_separator_color?: string
  header_bg_color?: string
  accent_text_color?: string
  destructive_text_color?: string
  subtitle_text_color?: string
}

export type TelegramMainButton = {
  setText: (text: string) => void
  setParams?: (params: {
    text?: string
    color?: string
    text_color?: string
    is_active?: boolean
    is_visible?: boolean
    has_shine_effect?: boolean
  }) => void
  show: () => void
  hide: () => void
  onClick: (callback: () => void) => void
  offClick: (callback: () => void) => void
}

export type TelegramWebApp = {
  initData: string
  initDataUnsafe?: { start_param?: string }
  version?: string
  colorScheme?: "light" | "dark"
  themeParams?: TelegramThemeParams
  viewportStableHeight?: number

  ready: () => void
  expand: () => void
  close?: () => void

  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  /** С версии 7.7. Свайп вниз закрывает приложение — при прокрутке ленты это происходит случайно. */
  disableVerticalSwipes?: () => void
  enableVerticalSwipes?: () => void
  /** С версии 6.2. Спрашивает подтверждение перед закрытием — нужно там, где есть незаполненная форма. */
  enableClosingConfirmation?: () => void
  disableClosingConfirmation?: () => void

  MainButton?: TelegramMainButton
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }

  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
    notificationOccurred?: (type: "error" | "success" | "warning") => void
    selectionChanged?: () => void
  }

  /** С версии 6.9. Открывает окно «поделиться» внутри Telegram. */
  switchInlineQuery?: (query: string, chatTypes?: Array<"users" | "bots" | "groups" | "channels">) => void
  openTelegramLink?: (url: string) => void
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

/**
 * Дождаться готовности платформы.
 *
 * Скрипт Telegram подключается отдельно и к моменту отрисовки может ещё
 * не выполниться. Ожидание короткое: если за четыре секунды платформы
 * нет, приложение открыто в обычном браузере.
 */
export async function waitForTelegramWebApp(timeoutMs = 4_000): Promise<TelegramWebApp | null> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (window.Telegram?.WebApp) return window.Telegram.WebApp
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  }
  return null
}

/** Короткий отклик на нажатие. Молча ничего не делает вне Telegram. */
export function tapFeedback(style: "light" | "medium" = "light"): void {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style)
}
