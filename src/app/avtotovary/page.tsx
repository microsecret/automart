import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { DEPARTMENTS, productGroupsOfDepartment } from "@/lib/product-groups"
import { groupHref } from "@/lib/product-group-pages"
import { PUBLIC_PART_WHERE } from "@/lib/parts-catalog-offers"
import ShopBar from "@/components/catalogs/ShopBar"
import styles from "@/components/catalogs/catalogs.module.css"

export const revalidate = 1800

export const metadata: Metadata = {
  title: "Автотовары: масла, автохимия, аксессуары, шины и запчасти",
  description: "Каталог автотоваров LeWheel: моторные масла и жидкости, аккумуляторы, шины и диски, автохимия, аксессуары и инструмент от магазинов с проверенными реквизитами.",
  alternates: { canonical: "/avtotovary" },
}

/** Все отделы и товарные группы — вход в каталог автотоваров. */
export default async function AvtotovaryPage() {
  const counts = await prisma.part.groupBy({
    by: ["productGroup"],
    where: { AND: [PUBLIC_PART_WHERE, { productGroup: { not: null } }] },
    _count: { _all: true },
  }).then((rows) => new Map(rows.map((row) => [row.productGroup as string, row._count._all]))).catch(() => new Map<string, number>())

  return (
    <main className={styles.page}>
      <ShopBar />
      <nav className={styles.crumbs} aria-label="Навигация">
        <Link href="/">Главная</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Автотовары</span>
      </nav>
      <header className={styles.pageHead}>
        <h1 className={styles.titleDark}>Автотовары</h1>
        <p className={styles.muted}>Масла и жидкости, аккумуляторы, шины, автохимия, аксессуары и инструмент — от магазинов с проверенными реквизитами.</p>
      </header>

      {DEPARTMENTS.map((department) => (
        <section key={department.key} aria-labelledby={`dept-${department.key}`}>
          <div className={styles.sectionHead}>
            <h2 id={`dept-${department.key}`} className={styles.h2}>{department.label}</h2>
            <span className={styles.sectionMeta}>{department.hint}</span>
          </div>
          <div className={styles.modelGrid}>
            {productGroupsOfDepartment(department.key).map((group) => {
              const count = counts.get(group.key) ?? 0
              return (
                <Link key={group.key} href={groupHref(group)} className={styles.groupTile} prefetch={false}>
                  <span className={styles.modelName}>{group.label}</span>
                  {count > 0 && <span className={styles.modelCount}>{count}</span>}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
