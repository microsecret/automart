"use client"

import Link from "next/link"
import { IconCheck, IconShoppingCart } from "@tabler/icons-react"
import { addToCart, useCart } from "@/lib/cart-store"

/**
 * «В корзину» → «В корзине»: после добавления кнопка ведёт в корзину, а не
 * добавляет ещё одну штуку незаметно для покупателя.
 */
export default function AddToCartButton({ partId, price, className, compact = false, label = "В корзину" }: {
  partId: string
  price: number
  className?: string
  compact?: boolean
  label?: string
}) {
  const inCart = useCart().some((item) => item.partId === partId)

  if (inCart) {
    return (
      <Link href="/cart" className={className} data-in-cart="" aria-label="Открыть корзину" prefetch={false}>
        <IconCheck size={compact ? 20 : 18} aria-hidden="true" />
        {!compact && <span>В корзине</span>}
      </Link>
    )
  }
  return (
    <button type="button" className={className} onClick={() => addToCart(partId, price)} aria-label={compact ? label : undefined}>
      <IconShoppingCart size={compact ? 20 : 18} aria-hidden="true" />
      {!compact && <span>{label}</span>}
    </button>
  )
}
