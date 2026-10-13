"use client"

import { useSyncExternalStore } from "react"

/**
 * Корзина в браузере.
 *
 * Заказ оформляется и без регистрации, поэтому корзина не может жить на
 * сервере за аккаунтом. Хранится позиция, количество и цена на момент
 * добавления — по ней страница корзины покажет «подешевело / подорожало».
 * Хранилище может быть недоступно (приватное окно, запрет сайта): тогда
 * корзина живёт до перезагрузки страницы, а не ломает её.
 */

export type CartItem = { partId: string; quantity: number; price: number; addedAt: number }

const KEY = "lw-cart-v1"
const EVENT = "lw-cart-change"
const MAX_ITEMS = 50
const MAX_QUANTITY = 999

let memory: CartItem[] = []
let cached: CartItem[] | null = null
const EMPTY: CartItem[] = []

function read(): CartItem[] {
  if (cached) return cached
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    cached = Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.partId === "string" && Number.isInteger(item.quantity) && item.quantity > 0).slice(0, MAX_ITEMS)
      : []
  } catch {
    cached = memory
  }
  return cached
}

function write(items: CartItem[]) {
  cached = items
  memory = items
  try { window.localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* остаётся в памяти */ }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) { cached = null; callback() }
  }
  window.addEventListener(EVENT, callback)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(EVENT, callback)
    window.removeEventListener("storage", onStorage)
  }
}

export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

export function useCartCount() {
  return useCart().reduce((sum, item) => sum + item.quantity, 0)
}

export function addToCart(partId: string, price: number, quantity = 1) {
  const items = read()
  const existing = items.find((item) => item.partId === partId)
  if (existing) {
    write(items.map((item) => item.partId === partId ? { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + quantity) } : item))
    return
  }
  if (items.length >= MAX_ITEMS) return
  write([...items, { partId, quantity: Math.min(MAX_QUANTITY, quantity), price, addedAt: Date.now() }])
}

export function setCartQuantity(partId: string, quantity: number) {
  const next = Math.max(0, Math.min(MAX_QUANTITY, Math.round(quantity)))
  const items = read()
  write(next === 0 ? items.filter((item) => item.partId !== partId) : items.map((item) => item.partId === partId ? { ...item, quantity: next } : item))
}

export function removeFromCart(partIds: string[]) {
  const drop = new Set(partIds)
  write(read().filter((item) => !drop.has(item.partId)))
}

/** Принять новые цены после сверки — «подорожало» больше не показывается. */
export function acceptCartPrices(prices: Array<{ partId: string; price: number }>) {
  const byId = new Map(prices.map((item) => [item.partId, item.price]))
  write(read().map((item) => byId.has(item.partId) ? { ...item, price: byId.get(item.partId) as number } : item))
}

export function clearCart(partIds?: string[]) {
  if (partIds) removeFromCart(partIds)
  else write([])
}
