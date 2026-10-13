import Link from "next/link"
import { IconPhoto } from "@tabler/icons-react"
import AddToCartButton from "@/components/cart/AddToCartButton"
import styles from "./catalogs.module.css"

export type PartOffer = {
  id: string
  name: string
  price: number
  image: string | null
  oemNumber: string | null
  brandName: string | null
  storeName: string | null
  supplyMode: string
  leadTimeDaysMin: number | null
  leadTimeDaysMax: number | null
  /** Главные характеристики строкой: «60 Ач · 540 А». */
  summary?: string
  /** Частное объявление в корзину не кладётся — его покупают через продавца. */
  canBuy?: boolean
  /** Город продавца — для частных объявлений вместо магазина. */
  location?: string | null
}

const rub = (value: number) => `${value.toLocaleString("ru-RU")} ₽`

function leadLabel(offer: PartOffer) {
  if (offer.supplyMode !== "ORDER") return "В наличии"
  if (!offer.leadTimeDaysMin) return "Под заказ"
  const max = offer.leadTimeDaysMax && offer.leadTimeDaysMax !== offer.leadTimeDaysMin ? `–${offer.leadTimeDaysMax}` : ""
  return `Под заказ, ${offer.leadTimeDaysMin}${max} дн.`
}

/**
 * Карточка товара в духе автомагазинов: снимок, название в две строки,
 * артикул и производитель таблицей, цена и кнопка заказа. Пустые строки
 * не выводятся — «Артикул: —» читается как ошибка магазина.
 */
export default function PartOfferCard({ offer }: { offer: PartOffer }) {
  const href = `/listings/part/${offer.id}`
  const specs = [
    offer.oemNumber ? ["Артикул", offer.oemNumber] : null,
    offer.brandName ? ["Производитель", offer.brandName] : null,
    offer.storeName ? ["Магазин", offer.storeName] : offer.location ? ["Город", offer.location] : null,
  ].filter(Boolean) as Array<[string, string]>

  return (
    <article className={styles.offerCard}>
      <Link href={href} className={styles.offerImage} prefetch={false} tabIndex={-1} aria-hidden="true">
        {offer.image ? <img src={offer.image} alt="" loading="lazy" decoding="async" /> : <IconPhoto size={44} stroke={1.3} />}
      </Link>
      <Link href={href} className={styles.offerTitle} prefetch={false}>{offer.name}</Link>
      {offer.summary && <span className={styles.offerSummary}>{offer.summary}</span>}
      {specs.length > 0 && (
        <dl className={styles.offerSpecs}>
          {specs.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      )}
      <div className={styles.offerFoot}>
        <div>
          <b className={styles.offerPrice}>{rub(offer.price)}</b>
          <span className={offer.supplyMode === "ORDER" ? styles.offerLeadOrder : styles.offerLeadStock}>{leadLabel(offer)}</span>
        </div>
        {offer.canBuy === false
          ? <Link href={href} className={styles.offerMore} prefetch={false}>Подробнее</Link>
          : <AddToCartButton partId={offer.id} price={offer.price} className={styles.offerBuy} compact label={`В корзину: ${offer.name}`} />}
      </div>
    </article>
  )
}
