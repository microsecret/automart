import Link from "next/link"
import { IconBuildingStore, IconPhoto } from "@tabler/icons-react"
import AddToCartButton from "@/components/cart/AddToCartButton"
import type { ArticleOffer } from "@/lib/part-number-offers"
import styles from "./catalogs.module.css"

const rub = (value: number) => `${value.toLocaleString("ru-RU")} ₽`

function lead(offer: ArticleOffer) {
  if (offer.supplyMode !== "ORDER") return { text: "В наличии", order: false }
  if (!offer.leadTimeDaysMin) return { text: "Под заказ", order: true }
  const max = offer.leadTimeDaysMax && offer.leadTimeDaysMax !== offer.leadTimeDaysMin ? `–${offer.leadTimeDaysMax}` : ""
  return { text: `${offer.leadTimeDaysMin}${max} дн.`, order: true }
}

/**
 * Плотный список предложений, как прайс у автомагазинов: производитель и
 * название, магазин, срок, цена и корзина в одну строку. Главное — цена и
 * срок; кто продаёт — вторая строка.
 */
export default function ArticleOfferList({ offers }: { offers: ArticleOffer[] }) {
  return (
    <ul className={styles.articleList}>
      {offers.map((offer) => {
        const term = lead(offer)
        return (
          <li key={offer.id} className={styles.articleRow}>
            <Link href={`/listings/part/${offer.id}`} className={styles.articleThumb} tabIndex={-1} aria-hidden="true" prefetch={false}>
              {offer.image ? <img src={offer.image} alt="" loading="lazy" /> : <IconPhoto size={24} stroke={1.4} />}
            </Link>
            <div className={styles.articleMain}>
              <span className={styles.articleBrand}>{offer.brandName || "Производитель не указан"}{offer.oemNumber ? ` · ${offer.oemNumber}` : ""}</span>
              <Link href={`/listings/part/${offer.id}`} className={styles.articleName} prefetch={false}>{offer.name}</Link>
              <span className={styles.articleSeller}>
                <IconBuildingStore size={14} aria-hidden="true" />
                {offer.store ? <Link href={`/store/${offer.store.slug}`} prefetch={false}>{offer.store.name}</Link> : "Частный продавец"}
                {(offer.store?.city || offer.location) ? ` · ${offer.store?.city || offer.location}` : ""}
                {offer.condition === "USED" ? " · б/у" : ""}
              </span>
            </div>
            <span className={term.order ? styles.articleLeadOrder : styles.articleLeadStock}>{term.text}</span>
            <b className={styles.articlePrice}>{rub(offer.price)}</b>
            {offer.store
              ? <AddToCartButton partId={offer.id} price={offer.price} className={styles.offerBuy} compact label={`В корзину: ${offer.name}`} />
              : <Link href={`/listings/part/${offer.id}`} className={styles.articleMore} prefetch={false}>Продавец</Link>}
          </li>
        )
      })}
    </ul>
  )
}
