"use client"

import { useEffect, useRef } from "react"
import { Box } from "@mantine/core"

/**
 * Тело сообщения форума.
 *
 * Разметка приходит уже собранной: экранирование и разбор сделаны на
 * сервере в src/lib/forum-markup.ts, здесь она только выводится.
 *
 * Клиентским компонент сделан ради спойлеров. Раскрытие по наведению
 * работает только на мышке — на телефоне наведения нет вовсе, и без
 * обработчика нажатия скрытый ответ остался бы скрытым навсегда.
 */

type Props = {
  html: string
  className?: string
  mt?: number
}

export default function PostBody({ html, className, mt }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const toggle = (element: Element) => {
      const open = element.getAttribute("data-open") === "true"
      element.setAttribute("data-open", open ? "false" : "true")
      element.setAttribute("aria-label", open ? "Показать скрытый текст" : "Скрыть текст")
    }

    const onClick = (event: MouseEvent) => {
      const spoiler = (event.target as Element | null)?.closest(".forum-spoiler")
      if (spoiler) toggle(spoiler)
    }

    /* Клавиатура наравне с мышью: спойлер помечен role="button", и
       читатель, который ходит по странице табуляцией, должен открывать
       его пробелом или вводом, как любую другую кнопку. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return
      const spoiler = (event.target as Element | null)?.closest(".forum-spoiler")
      if (!spoiler) return
      event.preventDefault()
      toggle(spoiler)
    }

    root.addEventListener("click", onClick)
    root.addEventListener("keydown", onKeyDown)
    return () => {
      root.removeEventListener("click", onClick)
      root.removeEventListener("keydown", onKeyDown)
    }
  }, [html])

  return (
    <Box
      ref={ref}
      className={className || "forum-post-body"}
      mt={mt}
      /* Разметка собрана своим разбором с экранированием всего
         постороннего — см. src/lib/forum-markup.ts. */
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
