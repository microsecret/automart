"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Box, Text } from "@mantine/core"
import { IconArrowLeft } from "@tabler/icons-react"
import { tapFeedback } from "@/lib/telegram-webapp"

/**
 * Возврат в мини-приложение со страницы сайта.
 *
 * Из мини-приложения человек попадает на обычные страницы сайта: форум,
 * запчасти, избранное, карточка машины. Раньше это был билет в один
 * конец — вместе с обычной страницей приезжала десктопная шапка,
 * подвал с соцсетями и боковой каталог, а вернуться в ленту было
 * нечем: панели вкладок там нет, кнопка «назад» Telegram не
 * показывалась, вертикальные жесты в мини-приложении отключены.
 * Человек закрывал приложение целиком.
 *
 * Полоса решает это одной строкой: она всегда сверху и всегда ведёт
 * обратно. История браузера предпочтительнее прямой ссылки — так
 * человек возвращается на ту вкладку, с которой ушёл, а не на главную
 * ленту.
 */
export default function TelegramReturnBar() {
  /* Кнопка «назад» платформы полезнее полосы: она стоит в шапке
     мессенджера, где человек её и ищет. Полоса — запасной вариант для
     клиентов, где кнопки нет. */
  const [hasPlatformBack, setHasPlatformBack] = useState(false)

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    const backButton = webApp?.BackButton
    if (!backButton) return

    const goBack = () => {
      webApp?.HapticFeedback?.impactOccurred("light")
      window.history.back()
    }

    backButton.onClick(goBack)
    backButton.show()
    setHasPlatformBack(true)

    return () => {
      backButton.offClick(goBack)
      backButton.hide()
    }
  }, [])

  if (hasPlatformBack) return null

  return (
    <Box className="tg-return-bar">
      <Link href="/telegram" onClick={() => tapFeedback("light")} className="tg-return-bar__link">
        <IconArrowLeft size={16} />
        <Text size="sm" fw={600}>Вернуться в приложение</Text>
      </Link>
    </Box>
  )
}
