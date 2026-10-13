"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { IconChevronRight, IconClipboardList, IconMenu2, IconX } from "@tabler/icons-react"
import { CATALOG_REGIONS, CATALOG_UNITS } from "@/lib/parts-catalog"
import CatalogSearch from "./CatalogSearch"
import styles from "./catalogs.module.css"

/**
 * Строка магазина, как у привычных автомагазинов: «Каталоги» — меню
 * разделов, широкий поиск по VIN, артикулу и названию, заказы.
 * Меню закрывается по Esc и клику мимо — иначе на телефоне оно
 * перекрывает страницу без выхода.
 */
export default function ShopBar() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onClick)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onClick)
    }
  }, [open])

  return (
    <div className={styles.shopBar} ref={rootRef}>
      <button
        type="button"
        className={`${styles.catalogButton} ${open ? styles.catalogButtonOpen : ""}`}
        aria-expanded={open}
        aria-controls="shop-catalog-menu"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <IconX size={20} /> : <IconMenu2 size={20} />}
        <span>Каталоги</span>
      </button>
      <CatalogSearch variant="bar" />
      <Link href="/dashboard/orders" className={styles.shopBarLink} prefetch={false}>
        <IconClipboardList size={20} />
        <span>Заказы</span>
      </Link>

      {open && (
        <div id="shop-catalog-menu" className={styles.megaMenu}>
          <div>
            <p className={styles.megaTitle}>По автомобилю</p>
            <ul className={styles.megaList}>
              {CATALOG_REGIONS.map((region) => (
                <li key={region.slug}>
                  <Link href={`/catalogs#${region.slug}`} onClick={() => setOpen(false)}>
                    {region.adjective} <IconChevronRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className={styles.megaTitle}>Каталог товаров</p>
            <ul className={`${styles.megaList} ${styles.megaListWide}`}>
              {CATALOG_UNITS.map((unit) => (
                <li key={unit.partType}>
                  <Link href={`/parts-finder?partType=${unit.partType}`} onClick={() => setOpen(false)}>
                    {unit.label} <IconChevronRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.megaAside}>
            <p className={styles.megaTitle}>Продавцам</p>
            <p>Откройте магазин: витрина, прайс одним файлом, заказы в Telegram.</p>
            <Link href="/sell" className={styles.sellerButton} onClick={() => setOpen(false)}>Открыть магазин</Link>
          </div>
        </div>
      )}
    </div>
  )
}
