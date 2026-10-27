"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { IconArrowRight, IconSearch } from "@tabler/icons-react"
import { decodeVin, looksLikeVin } from "@/lib/vin-decode"
import { catalogHref, findCatalogBrandByName } from "@/lib/parts-catalog"
import { matchKnownMake } from "@/lib/listing-make"
import { articleHref, looksLikeArticle } from "@/lib/article-number"
import styles from "./catalogs.module.css"

/**
 * Одна строка на три запроса, как в привычных каталогах: VIN, артикул или
 * марка. VIN расшифровывается по стандарту (страна, марка, год) и ведёт в
 * каталог марки; всё остальное — в поиск по номеру и названию.
 */
export default function CatalogSearch({ variant = "hero" }: { variant?: "hero" | "bar" }) {
  const router = useRouter()
  const [value, setValue] = useState("")
  const [note, setNote] = useState<string | null>(null)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const query = value.trim()
    if (!query) return
    setNote(null)

    if (looksLikeVin(query)) {
      const result = decodeVin(query)
      if (result.valid) {
        const brand = result.brand ? findCatalogBrandByName(matchKnownMake(result.brand) ?? result.brand) : null
        if (brand) {
          router.push(`${catalogHref(brand.name)}?vin=${result.vin}${result.modelYear ? `&year=${result.modelYear}` : ""}`)
          return
        }
        setNote(`VIN верный${result.region ? `, завод: ${result.region}` : ""}${result.modelYear ? `, ${result.modelYear} модельный год` : ""}. Марку по коду ${result.wmi} не узнали — выберите её ниже.`)
        return
      }
    }

    const brandName = matchKnownMake(query)
    const brand = brandName ? findCatalogBrandByName(brandName) : null
    if (brand && query.split(/\s+/).length <= 2) {
      router.push(catalogHref(brand.name))
      return
    }
    /* Номер детали — на страницу артикула: там предложения всех
       магазинов и аналоги, а не выдача по совпадению в названии. */
    if (looksLikeArticle(query)) {
      router.push(articleHref(query))
      return
    }
    router.push(`/parts-finder?q=${encodeURIComponent(query)}`)
  }

  return (
    <form className={`${styles.search} ${variant === "bar" ? styles.searchBar : ""}`} onSubmit={submit} role="search">
      <IconSearch size={20} className={styles.searchIcon} aria-hidden="true" />
      <input
        className={styles.searchInput}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        placeholder={variant === "bar" ? "Поиск по артикулу, названию, марке или VIN" : "VIN, артикул или марка"}
        aria-label="VIN, артикул или марка"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      <button type="submit" className={styles.searchButton} aria-label="Найти">
        <span>Найти</span>
        <IconArrowRight size={18} aria-hidden="true" />
      </button>
      {note && <p className={styles.searchNote} role="status">{note}</p>}
    </form>
  )
}
