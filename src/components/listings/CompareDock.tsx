"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconScale, IconX } from "@tabler/icons-react"
import { COMPARE_LIMIT, clearCompareList, compareDockPresence, readCompareList } from "@/lib/compare-list"

/**
 * Плашка «Сравнение N из 4» внизу экрана.
 *
 * Уведомление после добавления просило «откройте раздел „Сравнение“», но
 * ни ссылки, ни счётчика нигде не было: раздел прятался в меню «Сервисы».
 * Человек набирал машины и не видел ни сколько набрал, ни куда идти.
 *
 * Плашка появляется с первой машиной и выезжает снизу, откуда потом и
 * уходит, — связь «добавил → вот где оно лежит». На самой странице
 * сравнения её нет: там она повторяла бы заголовок.
 */
export default function CompareDock() {
  const pathname = usePathname()
  const [count, setCount] = useState(0)
  // Уход проигрывается до снятия с экрана: иначе плашка просто пропадала бы.
  const [leaving, setLeaving] = useState(false)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    compareDockPresence.mounted += 1
    return () => { compareDockPresence.mounted -= 1 }
  }, [])

  useEffect(() => {
    const sync = () => setCount(readCompareList().length)
    sync()
    window.addEventListener("compare-list-changed", sync)
    // Изменение из другой вкладки приходит только через storage.
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener("compare-list-changed", sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  useEffect(() => {
    if (count > 0) {
      setShown(count)
      setLeaving(false)
      return
    }
    if (shown === 0) return
    setLeaving(true)
    const timer = window.setTimeout(() => { setShown(0); setLeaving(false) }, 220)
    return () => window.clearTimeout(timer)
  }, [count, shown])

  if (!shown || pathname?.startsWith("/compare")) return null

  return (
    <div className="compare-dock" data-leaving={leaving || undefined} role="region" aria-label="Сравнение">
      <Link href="/compare" className="compare-dock__link">
        <IconScale size={18} stroke={1.8} aria-hidden="true" />
        <span>Сравнение</span>
        {/* key перезапускает короткий «кивок» счётчика при каждом изменении. */}
        <span key={shown} className="compare-dock__count">{shown} из {COMPARE_LIMIT}</span>
      </Link>
      <button type="button" className="compare-dock__clear" onClick={clearCompareList} aria-label="Очистить сравнение">
        <IconX size={16} stroke={2} aria-hidden="true" />
      </button>
    </div>
  )
}
