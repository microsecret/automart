"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Modal } from "@mantine/core"
import { IconCheck, IconChevronLeft, IconChevronRight, IconMinus, IconPhoto, IconPlus, IconShoppingCart, IconTrash } from "@tabler/icons-react"
import { addToCart, CART_ADDED_EVENT, setCartQuantity, useCart } from "@/lib/cart-store"
import styles from "./cart-added.module.css"

type Card = {
  id: string
  name: string
  price: number
  image: string | null
  brandName: string | null
  oemNumber: string | null
  supplyMode: string
  leadTimeDaysMin: number | null
  leadTimeDaysMax: number | null
  storeName: string | null
  reason: string | null
}

type Payload = { item: (Card & { storeCity: string | null }) | null; suggestions: Card[]; basis: "together" | "rules" | "none" }

const rub = (value: number) => `${value.toLocaleString("ru-RU")} ₽`

function leadLabel(card: Card) {
  if (card.supplyMode !== "ORDER") return "В наличии"
  if (!card.leadTimeDaysMin) return "Под заказ"
  const max = card.leadTimeDaysMax && card.leadTimeDaysMax !== card.leadTimeDaysMin ? `–${card.leadTimeDaysMax}` : ""
  return `Под заказ, ${card.leadTimeDaysMin}${max} дн.`
}

function goods(count: number) {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} товаров`
  if (last === 1) return `${count} товар`
  if (last >= 2 && last <= 4) return `${count} товара`
  return `${count} товаров`
}

/**
 * Окно после «В корзину», как у автомагазинов: что добавлено, сколько
 * всего в корзине, и что взять вместе.
 *
 * Подборка честно подписана: «С этим товаром покупают» — только когда за
 * ней настоящие совместные заказы; иначе «Пригодится вместе» с причиной
 * у каждой карточки («Масло меняют вместе с фильтром»).
 */
export default function CartAddedModal() {
  const router = useRouter()
  const cart = useCart()
  const [partId, setPartId] = useState<string | null>(null)
  const [data, setData] = useState<Payload | null>(null)
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onAdded = (event: Event) => {
      const id = (event as CustomEvent<{ partId: string }>).detail?.partId
      if (!id) return
      setPartId(id)
      setData(null)
    }
    window.addEventListener(CART_ADDED_EVENT, onAdded)
    return () => window.removeEventListener(CART_ADDED_EVENT, onAdded)
  }, [])

  useEffect(() => {
    if (!partId) return
    const controller = new AbortController()
    const exclude = cart.map((item) => item.partId).join(",")
    fetch(`/api/cart/suggestions?partId=${encodeURIComponent(partId)}&exclude=${encodeURIComponent(exclude)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setData(payload))
      .catch(() => undefined)
    return () => controller.abort()
    // Подборка считается один раз на добавление: пересчёт на каждое
    // изменение корзины перемешивал бы карточки под рукой.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId])

  const close = () => setPartId(null)
  const line = cart.find((item) => item.partId === partId)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const units = cart.reduce((sum, item) => sum + item.quantity, 0)
  const item = data?.item
  const suggestions = data?.suggestions ?? []
  const scroll = (direction: 1 | -1) => railRef.current?.scrollBy({ left: direction * 260, behavior: "smooth" })

  return (
    <Modal
      opened={Boolean(partId)}
      onClose={close}
      size={880}
      radius={16}
      centered
      title={<span className={styles.title}><IconCheck size={22} className={styles.titleIcon} /> Товар добавлен в корзину</span>}
      classNames={{ body: styles.body }}
      transitionProps={{ transition: "pop", duration: 180 }}
    >
      <div className={styles.line}>
        <span className={styles.thumb}>{item?.image ? <img src={item.image} alt="" /> : <IconPhoto size={26} stroke={1.4} />}</span>
        <div className={styles.lineMain}>
          {item ? (
            <>
              <span className={styles.brand}>{[item.brandName, item.oemNumber].filter(Boolean).join(" · ") || item.storeName}</span>
              <span className={styles.name}>{item.name}</span>
              <span className={item.supplyMode === "ORDER" ? styles.leadOrder : styles.leadStock}>
                {leadLabel(item)}{item.storeName ? ` · ${item.storeName}${item.storeCity ? `, ${item.storeCity}` : ""}` : ""}
              </span>
            </>
          ) : <span className={styles.skeletonLine} aria-hidden="true" />}
        </div>
        {line && (
          <div className={styles.stepper} role="group" aria-label="Количество">
            <button type="button" onClick={() => setCartQuantity(line.partId, line.quantity - 1)} aria-label="Меньше">
              {line.quantity === 1 ? <IconTrash size={16} /> : <IconMinus size={16} />}
            </button>
            <span>{line.quantity}</span>
            <button type="button" onClick={() => setCartQuantity(line.partId, line.quantity + 1)} aria-label="Больше"><IconPlus size={16} /></button>
          </div>
        )}
        <b className={styles.price}>{line ? rub(line.price * line.quantity) : ""}</b>
      </div>

      {item?.supplyMode === "ORDER" && (
        <p className={styles.note}>Срок — до отправки магазином. Доставку и оплату магазин согласует после звонка.</p>
      )}

      <div className={styles.actions}>
        <span className={styles.summary}>В корзине <Link href="/cart" onClick={close}>{goods(units)} на {rub(total)}</Link></span>
        <button type="button" className={styles.secondary} onClick={close}>Продолжить покупки</button>
        <button type="button" className={styles.primary} onClick={() => { close(); router.push("/cart") }}>Оформить заказ</button>
      </div>

      {suggestions.length > 0 && (
        <section className={styles.rail} aria-labelledby="cart-suggest-title">
          <header className={styles.railHead}>
            <h2 id="cart-suggest-title">{data?.basis === "together" ? "С этим товаром покупают" : "Пригодится вместе"}</h2>
            <div className={styles.railNav}>
              <button type="button" onClick={() => scroll(-1)} aria-label="Назад"><IconChevronLeft size={18} /></button>
              <button type="button" onClick={() => scroll(1)} aria-label="Вперёд"><IconChevronRight size={18} /></button>
            </div>
          </header>
          <div className={styles.cards} ref={railRef}>
            {suggestions.map((card) => {
              const inCart = cart.some((entry) => entry.partId === card.id)
              return (
                <article key={card.id} className={styles.card}>
                  <Link href={`/listings/part/${card.id}`} className={styles.cardImage} onClick={close} tabIndex={-1} aria-hidden="true">
                    {card.image ? <img src={card.image} alt="" loading="lazy" /> : <IconPhoto size={34} stroke={1.3} />}
                  </Link>
                  {card.reason && <span className={styles.reason}>{card.reason}</span>}
                  <Link href={`/listings/part/${card.id}`} className={styles.cardName} onClick={close}>{card.name}</Link>
                  <dl className={styles.cardSpecs}>
                    {card.brandName && <div><dt>Бренд</dt><dd>{card.brandName}</dd></div>}
                    {card.oemNumber && <div><dt>Артикул</dt><dd>{card.oemNumber}</dd></div>}
                  </dl>
                  <div className={styles.cardFoot}>
                    <b>{rub(card.price)}</b>
                    <button
                      type="button"
                      className={inCart ? styles.cardAdded : styles.cardAdd}
                      onClick={() => { if (!inCart) addToCart(card.id, card.price, 1, { silent: true }) }}
                      aria-label={inCart ? "Уже в корзине" : `В корзину: ${card.name}`}
                      disabled={inCart}
                    >
                      {inCart ? <IconCheck size={18} /> : <IconShoppingCart size={18} />}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </Modal>
  )
}
