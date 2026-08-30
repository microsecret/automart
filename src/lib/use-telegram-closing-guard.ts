"use client"

import { useEffect } from "react"

/**
 * Спрашивает подтверждение перед закрытием мини-приложения.
 *
 * Внутри Telegram приложение закрывается одним движением — свайпом
 * вниз или крестиком в углу, и делается это случайно чаще, чем
 * осознанно. Человек, наполовину заполнивший объявление, терял всё
 * молча: черновиков в мини-приложении нет, а формы длинные.
 *
 * Платформа умеет спрашивать «точно закрыть?», и метод для этого был
 * описан в типе с пояснением «нужно там, где есть незаполненная
 * форма», — но не вызывался нигде.
 *
 * Вопрос задаётся только когда есть что терять: пустая форма закроется
 * без лишних окон, потому что предупреждать не о чем.
 *
 * Вне Telegram ничего не делает — там о том же заботится сам браузер.
 */
export function useTelegramClosingGuard(hasUnsavedInput: boolean) {
  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp?.enableClosingConfirmation) return

    if (hasUnsavedInput) {
      webApp.enableClosingConfirmation()
    } else {
      webApp.disableClosingConfirmation?.()
    }

    /* Уходя со страницы, снимаем вопрос: он относится к этой форме, а
       не ко всему приложению — иначе лента начнёт переспрашивать при
       каждом закрытии. */
    return () => {
      webApp.disableClosingConfirmation?.()
    }
  }, [hasUnsavedInput])
}
