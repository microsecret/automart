"use client"

import { plural as sharedPlural } from "@/lib/format"
import Image from "next/image"
import Link from "next/link"
import useSWR from "swr"
import { Box, Text } from "@mantine/core"
import { IconArrowRight } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import styles from "./category-showcase.module.css"

/**
 * Витрина направлений на главной.
 *
 * Раньше человек попадал сразу в список объявлений и видел выдачу целиком —
 * без понимания, что ещё есть на площадке. Витрина показывает направления и
 * их наполнение, а список остаётся ниже для тех, кто пришёл смотреть всё.
 */

type CountsResponse = { counts: Record<string, number> }

const DIRECTIONS = [
  { slug: "cars", href: "/category/cars", label: "Легковые", hint: "Седаны, кроссоверы, хэтчбеки" },
  { slug: "moto", href: "/category/moto", label: "Мото", hint: "Мотоциклы, скутеры, квадроциклы" },
  { slug: "trucks", href: "/category/trucks", label: "Грузовики", hint: "Тягачи, фургоны, самосвалы" },
  { slug: "special", href: "/category/special", label: "Спецтехника", hint: "Экскаваторы, погрузчики, краны" },
  { slug: "water", href: "/category/water", label: "Водный транспорт", hint: "Катера, лодки, гидроциклы" },
  { slug: "air", href: "/category/air", label: "Воздушный транспорт", hint: "Самолёты, вертолёты, дроны" },
  { slug: "parts", href: "/parts-finder", label: "Запчасти", hint: "Подбор по автомобилю и артикулу" },
] as const

/* Склонение берётся из общей функции: это правило было написано в
   проекте трижды, и каждая копия — риск разойтись при следующей правке. */
function plural(count: number) {
  return sharedPlural(count, "объявление", "объявления", "объявлений")
}

export default function CategoryShowcase() {
  const { data } = useSWR<CountsResponse>("/api/listings/counts", fetchJson, {
    revalidateOnFocus: false,
  })
  const counts = data?.counts

  return (
    <Box component="section" className={styles.showcase} aria-labelledby="directions-title">
      <div className={styles.head}>
        <Text component="h2" id="directions-title" className={styles.title}>Направления каталога</Text>
        <Link href="/search" prefetch={false} className={styles.all}>Весь каталог →</Link>
      </div>

      <div className={styles.grid}>
        {DIRECTIONS.map(({ slug, href, label, hint }) => {
          const count = counts?.[slug]
          const featured = slug === "cars"
          const low = featured ? 512 : 384
          const high = featured ? 768 : 640
          const artwork = `/images/ui/catalog-directions-v2/${slug}`
          return (
            <Link key={slug} href={href} prefetch={false} className={styles.card} data-direction={slug}>
              <picture className={styles.picture}>
                <source srcSet={`${artwork}-${low}.webp ${low}w, ${artwork}-${high}.webp ${high}w`}
                  sizes={featured ? "(max-width: 992px) 95vw, 330px" : "(max-width: 992px) 45vw, 240px"} />
                <Image src={`${artwork}-${low}.webp`} width={low} height={Math.round(low * 2 / 3)}
                  alt="" unoptimized loading="lazy" decoding="async" draggable={false} />
              </picture>
              <span className={styles.label}>{label}</span>
              <span className={styles.hint}>{hint}</span>
              <span className={styles.meta}>
                {typeof count === "number" && (count > 0 ? `${count} ${plural(count)}` : "Пока без объявлений")}
              </span>
              <IconArrowRight size={17} stroke={1.8} className={styles.arrow} aria-hidden="true" />
            </Link>
          )
        })}
      </div>
    </Box>
  )
}
