"use client"

import { useCallback, useEffect, useState } from "react"
import { notifications } from "@mantine/notifications"
import { COMPARE_LIMIT, readCompareList, toggleCompare } from "@/lib/compare-list"

/**
 * Участие объявления в сравнении.
 *
 * Логика жила в карточке каталога, а в списочном виде кнопки сравнения не
 * было вовсе: человек переключал вид отображения и терял возможность
 * сравнить машины. Здесь она одна на оба вида — и на всё, что появится
 * дальше.
 */
export function useCompare(listingId: string) {
  const [inCompare, setInCompare] = useState(false)

  useEffect(() => {
    const sync = () => setInCompare(readCompareList().includes(listingId))
    sync()
    // Список меняется и в соседних карточках, и в других вкладках.
    window.addEventListener("compare-list-changed", sync)
    return () => window.removeEventListener("compare-list-changed", sync)
  }, [listingId])

  const toggle = useCallback((event: React.MouseEvent) => {
    /* Карточка целиком — ссылка на объявление: без остановки события
       нажатие на кнопку открыло бы страницу вместо добавления. */
    event.preventDefault()
    event.stopPropagation()

    const result = toggleCompare(listingId)
    setInCompare(result.ids.includes(listingId))

    if (result.limitReached) {
      notifications.show({
        title: "В сравнении уже четыре машины",
        message: "Уберите одну из списка, чтобы добавить эту.",
        color: "orange",
      })
      return
    }

    notifications.show({
      title: result.added ? "Добавлено к сравнению" : "Убрано из сравнения",
      message: result.added
        ? `В сравнении ${result.ids.length} из ${COMPARE_LIMIT} — откройте раздел «Сравнение», когда наберёте нужные.`
        : "Машина больше не участвует в сравнении.",
      color: result.added ? "indigo" : "gray",
    })
  }, [listingId])

  return { inCompare, toggleCompare: toggle }
}
