import Link from "next/link"
import { IconBuildingStore, IconCar, IconChevronRight } from "@tabler/icons-react"
import { prisma } from "@/lib/prisma"
import { DEPARTMENTS, productGroupsOfDepartment } from "@/lib/product-groups"
import { groupHref } from "@/lib/product-group-pages"
import { PUBLIC_PART_WHERE } from "@/lib/parts-catalog-offers"
import styles from "./home-market.module.css"

/* Главные группы отдела на главной — не больше четырёх, остальное по
   ссылке «все». Порядок — как люди ищут чаще: масла, АКБ, шины. */
const FEATURED: Readonly<Record<string, readonly string[]>> = {
  parts: ["battery", "brake_pads", "oil_filter", "spark_plugs"],
  fluids: ["engine_oil", "antifreeze", "transmission_oil", "brake_fluid"],
  tires: ["tires", "wheels"],
  chemicals: ["chem_body", "chem_engine", "chem_additives", "greases"],
  accessories: ["dashcams", "car_mats", "bulbs", "wiper_blades"],
  tools: ["compressors", "jacks", "tool_sets", "chargers"],
}

/**
 * Запчасти и автотовары на главной.
 *
 * Новые разделы — каталоги по маркам, автотовары, магазины — были видны
 * только из меню и подвала, а главная — основной вход на сайт. Счётчики
 * показываются лишь там, где товар есть: «0 предложений» отговаривает
 * лучше любого текста.
 */
export default async function HomeMarketBlock() {
  const counts = await prisma.part.groupBy({
    by: ["productGroup"],
    where: { AND: [PUBLIC_PART_WHERE, { productGroup: { not: null } }] },
    _count: { _all: true },
  }).then((rows) => new Map(rows.map((row) => [row.productGroup as string, row._count._all]))).catch(() => new Map<string, number>())

  return (
    <section className={styles.block} aria-labelledby="home-market-title">
      <header className={styles.head}>
        <div>
          <h2 id="home-market-title" className={styles.title}>Запчасти и автотовары</h2>
          <p className={styles.lead}>Масла, аккумуляторы, шины, автохимия и аксессуары от магазинов с проверенными реквизитами.</p>
        </div>
        <div className={styles.actions}>
          <Link href="/catalogs" className={styles.primary}><IconCar size={18} /> Каталоги по маркам и VIN</Link>
          <Link href="/sell" className={styles.secondary}><IconBuildingStore size={18} /> Открыть магазин</Link>
        </div>
      </header>
      <div className={styles.grid}>
        {DEPARTMENTS.map((department) => {
          const groups = productGroupsOfDepartment(department.key)
          const featured = (FEATURED[department.key] ?? []).map((key) => groups.find((group) => group.key === key)).filter(Boolean)
          return (
            <article key={department.key} className={styles.card}>
              <Link href={`/avtotovary#dept-${department.key}`} className={styles.cardTitle}>
                {department.label} <IconChevronRight size={16} aria-hidden="true" />
              </Link>
              <ul className={styles.list}>
                {featured.map((group) => group && (
                  <li key={group.key}>
                    <Link href={groupHref(group)}>
                      <span>{group.label}</span>
                      {(counts.get(group.key) ?? 0) > 0 && <b>{counts.get(group.key)}</b>}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}
