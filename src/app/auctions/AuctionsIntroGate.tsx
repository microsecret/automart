"use client"

import { usePathname } from "next/navigation"

/**
 * Вступление каталога аукционов — только на самом каталоге.
 *
 * Оно лежит в layout.tsx и поэтому повторялось над каждым лотом: заголовок
 * «Автомобильные аукционы мира» и три карточки стояли между шапкой и
 * названием машины, и фото лота уезжало за первый экран. Разметка по-прежнему
 * рисуется на сервере — поисковик видит её на /auctions, как и раньше.
 */
export default function AuctionsIntroGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname !== "/auctions") return null
  return <>{children}</>
}
