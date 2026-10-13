"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import {
  IconArrowDownRight, IconArrowUpRight, IconBuildingStore, IconCircleCheck, IconMinus, IconPhoto,
  IconPlus, IconShoppingCart, IconTrash,
} from "@tabler/icons-react"
import { acceptCartPrices, clearCart, removeFromCart, setCartQuantity, useCart } from "@/lib/cart-store"
import styles from "./cart.module.css"

type QuoteItem =
  | { partId: string; available: false }
  | {
      partId: string
      available: true
      name: string
      price: number
      image: string | null
      oemNumber: string | null
      brandName: string | null
      supplyMode: string
      leadTimeDaysMin: number | null
      leadTimeDaysMax: number | null
      store: { id: string; name: string; slug: string; city: string | null }
    }

type CheckoutResult = { checkoutId: string; stores: Array<{ storeId: string; storeName: string; orders: number; total: number }> }

const rub = (value: number) => `${value.toLocaleString("ru-RU")} ₽`

function goods(count: number) {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} товаров`
  if (last === 1) return `${count} товар`
  if (last >= 2 && last <= 4) return `${count} товара`
  return `${count} товаров`
}

/** «в 2 магазина», «в 5 магазинов». */
function storesWord(count: number) {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return "магазинов"
  if (last === 1) return "магазин"
  if (last >= 2 && last <= 4) return "магазина"
  return "магазинов"
}

function leadLabel(item: Extract<QuoteItem, { available: true }>) {
  if (item.supplyMode !== "ORDER") return "В наличии"
  if (!item.leadTimeDaysMin) return "Под заказ"
  const max = item.leadTimeDaysMax && item.leadTimeDaysMax !== item.leadTimeDaysMin ? `–${item.leadTimeDaysMax}` : ""
  return `Под заказ, ${item.leadTimeDaysMin}${max} дн.`
}

const quoteFetcher = async ([, ids]: [string, string]) => {
  const response = await fetch("/api/cart/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ partIds: ids.split(",") }),
  })
  if (!response.ok) throw new Error("Не удалось обновить корзину")
  return (await response.json()) as { items: QuoteItem[] }
}

/**
 * Корзина из позиций разных магазинов.
 *
 * Покупатель собирает детали у нескольких продавцов и оформляет их одним
 * действием; каждый магазин получает свой заказ и звонит сам. Цены и
 * наличие сверяются с сервером при каждом открытии.
 */
export default function CartPage() {
  const cart = useCart()
  const { data: session } = useSession()
  const ids = useMemo(() => cart.map((item) => item.partId).sort().join(","), [cart])
  const { data, error, isLoading, mutate } = useSWR(ids ? ["cart-quote", ids] : null, quoteFetcher, { revalidateOnFocus: true })

  const [form, setForm] = useState({ contactName: "", contactPhone: "", contactEmail: "", city: "", comment: "" })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<CheckoutResult | null>(null)

  /* Имя и почта из профиля — меньше полей руками; телефон профиль не
     хранит, его покупатель вводит сам. */
  useEffect(() => {
    if (!session?.user) return
    setForm((current) => ({
      ...current,
      contactName: current.contactName || session.user?.name || "",
      contactEmail: current.contactEmail || session.user?.email || "",
    }))
  }, [session?.user])

  const quotes = new Map((data?.items || []).map((item) => [item.partId, item]))
  const lines = cart.map((item) => ({ cart: item, quote: quotes.get(item.partId) }))
  const available = lines.filter((line) => line.quote?.available) as Array<{ cart: typeof cart[number]; quote: Extract<QuoteItem, { available: true }> }>
  const unavailable = lines.filter((line) => line.quote && !line.quote.available)
  const changed = available.filter((line) => line.quote.price !== line.cart.price)

  const groups = useMemo(() => {
    const map = new Map<string, { store: Extract<QuoteItem, { available: true }>["store"]; lines: typeof available }>()
    for (const line of available) {
      const group = map.get(line.quote.store.id) ?? { store: line.quote.store, lines: [] }
      group.lines.push(line)
      map.set(line.quote.store.id, group)
    }
    return [...map.values()]
  }, [available])

  const total = available.reduce((sum, line) => sum + line.quote.price * line.cart.quantity, 0)
  const units = available.reduce((sum, line) => sum + line.cart.quantity, 0)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    setFieldErrors({})
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: available.map((line) => ({ partId: line.cart.partId, quantity: line.cart.quantity, price: line.cart.price })),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setFieldErrors(payload?.fieldErrors || {})
        setSubmitError(typeof payload?.error === "string" ? payload.error : "Не удалось оформить заказ")
        if (payload?.priceChanged || payload?.unavailable) await mutate()
        return
      }
      setResult(payload as CheckoutResult)
      clearCart(available.map((line) => line.cart.partId))
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setSubmitError("Связь прервалась. Проверьте интернет и отправьте ещё раз.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (result) {
    return (
      <main className={styles.page}>
        <section className={styles.success}>
          <IconCircleCheck size={48} stroke={1.5} className={styles.successIcon} />
          <h1 className={styles.title}>Заказ оформлен</h1>
          <p className={styles.muted}>
            {result.stores.length > 1
              ? `Заказ ушёл в ${result.stores.length} ${storesWord(result.stores.length)} — каждый свяжется с вами сам, чтобы подтвердить наличие, срок и оплату.`
              : "Магазин свяжется с вами, чтобы подтвердить наличие, срок и оплату."}
          </p>
          <ul className={styles.successList}>
            {result.stores.map((store) => (
              <li key={store.storeId}>
                <span><IconBuildingStore size={18} /> {store.storeName}</span>
                <b>{rub(store.total)}</b>
              </li>
            ))}
          </ul>
          <div className={styles.successActions}>
            {session?.user && <Link href="/dashboard/orders" className={styles.primaryButton}>Мои заказы</Link>}
            <Link href="/catalogs" className={styles.secondaryButton}>Продолжить покупки</Link>
          </div>
        </section>
      </main>
    )
  }

  if (!cart.length) {
    return (
      <main className={styles.page}>
        <section className={styles.empty}>
          <span className={styles.emptyIcon}><IconShoppingCart size={34} stroke={1.5} /></span>
          <h1 className={styles.title}>Корзина пуста</h1>
          <p className={styles.muted}>Добавляйте детали из каталога — даже из разных магазинов. Оформление одно на всех.</p>
          <div className={styles.successActions}>
            <Link href="/catalogs" className={styles.primaryButton}>Каталоги по маркам</Link>
            <Link href="/parts-finder" className={styles.secondaryButton}>Поиск запчастей</Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Корзина <span className={styles.count}>{goods(units || cart.length)}</span></h1>
        {groups.length > 1 && <p className={styles.muted}>Позиции из {groups.length} {groups.length % 10 === 1 && groups.length % 100 !== 11 ? "магазина" : "магазинов"} — каждый получит свой заказ.</p>}
      </header>

      <div className={styles.layout}>
        <div className={styles.items}>
          {isLoading && !data && <div className={styles.skeleton} aria-busy="true" />}
          {error && <p className={styles.alert}>Не удалось сверить цены. <button type="button" onClick={() => mutate()}>Повторить</button></p>}

          {changed.length > 0 && (
            <div className={styles.notice} role="status">
              <span>Цена изменилась у {changed.length} {changed.length === 1 ? "позиции" : "позиций"} — в итоге уже новая.</span>
              <button type="button" onClick={() => acceptCartPrices(changed.map((line) => ({ partId: line.cart.partId, price: line.quote.price })))}>Понятно</button>
            </div>
          )}

          {groups.map((group) => {
            const subtotal = group.lines.reduce((sum, line) => sum + line.quote.price * line.cart.quantity, 0)
            return (
              <section key={group.store.id} className={styles.storeGroup} aria-label={`Магазин ${group.store.name}`}>
                <header className={styles.storeHead}>
                  <Link href={`/store/${group.store.slug}`} className={styles.storeName}>
                    <IconBuildingStore size={18} /> {group.store.name}
                  </Link>
                  {group.store.city && <span className={styles.muted}>{group.store.city}</span>}
                </header>
                <ul className={styles.lines}>
                  {group.lines.map(({ cart: item, quote }) => {
                    const delta = quote.price - item.price
                    return (
                      <li key={item.partId} className={styles.line}>
                        <Link href={`/listings/part/${item.partId}`} className={styles.thumb} tabIndex={-1} aria-hidden="true">
                          {quote.image ? <img src={quote.image} alt="" loading="lazy" /> : <IconPhoto size={26} stroke={1.4} />}
                        </Link>
                        <div className={styles.lineMain}>
                          <Link href={`/listings/part/${item.partId}`} className={styles.lineName}>{quote.name}</Link>
                          <span className={styles.lineMeta}>
                            {[quote.brandName, quote.oemNumber].filter(Boolean).join(" · ")}
                            {(quote.brandName || quote.oemNumber) ? " · " : ""}
                            <span className={quote.supplyMode === "ORDER" ? styles.leadOrder : styles.leadStock}>{leadLabel(quote)}</span>
                          </span>
                          {delta !== 0 && (
                            <span className={delta < 0 ? styles.cheaper : styles.dearer}>
                              {delta < 0 ? <IconArrowDownRight size={14} /> : <IconArrowUpRight size={14} />}
                              {delta < 0 ? "Подешевело" : "Подорожало"} на {rub(Math.abs(delta))}
                            </span>
                          )}
                        </div>
                        <div className={styles.stepper} role="group" aria-label="Количество">
                          <button type="button" onClick={() => setCartQuantity(item.partId, item.quantity - 1)} aria-label="Меньше">
                            {item.quantity === 1 ? <IconTrash size={16} /> : <IconMinus size={16} />}
                          </button>
                          <input
                            inputMode="numeric"
                            aria-label="Количество"
                            value={item.quantity}
                            onChange={(event) => {
                              const next = Number(event.currentTarget.value.replace(/\D/g, ""))
                              if (next > 0) setCartQuantity(item.partId, next)
                            }}
                          />
                          <button type="button" onClick={() => setCartQuantity(item.partId, item.quantity + 1)} aria-label="Больше">
                            <IconPlus size={16} />
                          </button>
                        </div>
                        <div className={styles.linePrice}>
                          <b>{rub(quote.price * item.quantity)}</b>
                          {item.quantity > 1 && <small>{rub(quote.price)} за шт</small>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <footer className={styles.storeFoot}>
                  <span>Итого в магазине</span>
                  <b>{rub(subtotal)}</b>
                </footer>
              </section>
            )
          })}

          {unavailable.length > 0 && (
            <section className={styles.unavailable}>
              <p>{unavailable.length === 1 ? "Позиция больше не продаётся" : `${unavailable.length} позиции больше не продаются`} — магазин снял её или закрыл витрину.</p>
              <button type="button" onClick={() => removeFromCart(unavailable.map((line) => line.cart.partId))}>Убрать из корзины</button>
            </section>
          )}
        </div>

        <aside className={styles.summary}>
          <div className={styles.summaryTotal}>
            <span>Итого</span>
            <b>{rub(total)}</b>
          </div>
          <p className={styles.summaryNote}>
            Оплату и доставку согласует магазин после звонка. Онлайн-оплаты на площадке пока нет.
          </p>
          <form className={styles.form} onSubmit={submit} noValidate>
            <label>
              <span>Имя</span>
              <input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.currentTarget.value })} autoComplete="name" required aria-invalid={Boolean(fieldErrors.contactName)} />
              {fieldErrors.contactName && <small>{fieldErrors.contactName}</small>}
            </label>
            <label>
              <span>Телефон</span>
              <input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.currentTarget.value })} type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 900 000-00-00" required aria-invalid={Boolean(fieldErrors.contactPhone)} />
              {fieldErrors.contactPhone && <small>{fieldErrors.contactPhone}</small>}
            </label>
            <label>
              <span>Почта <em>необязательно</em></span>
              <input value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.currentTarget.value })} type="email" inputMode="email" autoComplete="email" aria-invalid={Boolean(fieldErrors.contactEmail)} />
              {fieldErrors.contactEmail && <small>{fieldErrors.contactEmail}</small>}
            </label>
            <label>
              <span>Город доставки <em>необязательно</em></span>
              <input value={form.city} onChange={(event) => setForm({ ...form, city: event.currentTarget.value })} autoComplete="address-level2" />
            </label>
            <label>
              <span>Комментарий <em>необязательно</em></span>
              <textarea rows={2} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.currentTarget.value })} placeholder="VIN, удобное время звонка" />
            </label>
            {submitError && <p className={styles.alert} role="alert">{submitError}</p>}
            <button type="submit" className={styles.submit} disabled={isSubmitting || !available.length}>
              {isSubmitting ? "Оформляем…" : groups.length > 1 ? `Оформить в ${groups.length} ${storesWord(groups.length)}` : "Оформить заказ"}
            </button>
          </form>
        </aside>
      </div>
    </main>
  )
}
