"use client"

import Link from "next/link"
import { IconShoppingCart } from "@tabler/icons-react"
import { useCartCount } from "@/lib/cart-store"

/** Ссылка «Корзина» со счётчиком штук — для строки магазина. */
export default function CartLink({ className, badgeClassName }: { className?: string; badgeClassName?: string }) {
  const count = useCartCount()
  return (
    <Link href="/cart" className={className} prefetch={false} aria-label={count ? `Корзина: ${count} шт` : "Корзина"}>
      <IconShoppingCart size={20} aria-hidden="true" />
      <span>Корзина</span>
      {count > 0 && <span className={badgeClassName}>{count > 99 ? "99+" : count}</span>}
    </Link>
  )
}
