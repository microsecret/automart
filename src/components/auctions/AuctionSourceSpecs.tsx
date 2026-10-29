import type { AuctionSourceSpec } from "@/lib/auction-source-details"
import styles from "./auction-source-specs.module.css"

/** Presentation only: source facts and missing-value wording stay canonical. */
export default function AuctionSourceSpecs({ items }: { items: readonly AuctionSourceSpec[] }) {
  return <dl className={styles.list} aria-label="Характеристики из первоисточника">
    {items.map(item => <div className={styles.row} key={`${item.label}-${item.detail}`} data-available={item.available}>
      <dt className={styles.label}>{item.label}</dt>
      <dd className={styles.value}>{item.detail}</dd>
    </div>)}
  </dl>
}
