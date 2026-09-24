"use client"

import { plural as sharedPlural } from "@/lib/format"
import Link from "next/link"
import useSWR from "swr"
import { Box, Text } from "@mantine/core"
import {
  IconCar, IconMotorbike, IconTruck, IconTractor, IconSpeedboat, IconPlane, IconTools,
} from "@tabler/icons-react"
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
  { slug: "cars", href: "/category/cars", label: "Легковые", hint: "Седаны, кроссоверы, хэтчбеки", Icon: IconCar, tone: "blue" },
  { slug: "moto", href: "/category/moto", label: "Мото", hint: "Мотоциклы, скутеры, квадроциклы", Icon: IconMotorbike, tone: "grape" },
  { slug: "trucks", href: "/category/trucks", label: "Грузовики", hint: "Тягачи, фургоны, самосвалы", Icon: IconTruck, tone: "indigo" },
  { slug: "special", href: "/category/special", label: "Спецтехника", hint: "Экскаваторы, погрузчики, краны", Icon: IconTractor, tone: "orange" },
  { slug: "water", href: "/category/water", label: "Водный транспорт", hint: "Катера, лодки, гидроциклы", Icon: IconSpeedboat, tone: "cyan" },
  { slug: "air", href: "/category/air", label: "Воздушный транспорт", hint: "Самолёты, вертолёты, дроны", Icon: IconPlane, tone: "teal" },
  { slug: "parts", href: "/parts-finder", label: "Запчасти", hint: "Подбор по вашему автомобилю", Icon: IconTools, tone: "red" },
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

  /* Панель по образцу площадки-образца: тёмная шапка с подписью и выходом
     в каталог, под ней плитки направлений на цветной подложке.

     Прежние белые карточки с кружком-значком стояли среди таких же белых
     карточек объявлений и терялись; владелец не понял, к чему относится
     «Выберите направление». Панель читается одним предметом — навигацией
     по каталогу, а не ещё одной лентой товаров.

     Сетка 4×2 ровная: «Легковые» — единственное наполненное направление —
     занимает две клетки по высоте, и семь плиток закрывают восемь клеток
     без дыры в последнем ряду. */
  return (
    <Box component="section" className={styles.showcase} aria-labelledby="directions-title">
      <div className={styles.head}>
        <Text component="h2" id="directions-title" className={styles.title}>Направления каталога</Text>
        <Link href="/search" prefetch={false} className={styles.all}>Весь каталог →</Link>
      </div>

      <div className={styles.grid}>
        {DIRECTIONS.map(({ slug, href, label, hint, Icon, tone }) => {
          const count = counts?.[slug]
          return (
            <Link key={slug} href={href} prefetch={false} className={styles.card} data-tone={tone}>
              <Icon className={styles.watermark} size={96} stroke={1} aria-hidden="true" />
              <span className={styles.icon} aria-hidden="true"><Icon size={18} stroke={1.8} /></span>
              <span className={styles.label}>{label}</span>
              <span className={styles.hint}>{hint}</span>
              {/* Пустое направление показывает не «0», а приглашение: ноль
                  читается как «здесь ничего не будет». Пока счётчики
                  грузятся, строки нет — чтобы плитки не дёргались. */}
              {typeof count === "number" && (
                <span className={styles.meta} data-empty={count > 0 ? undefined : "true"}>
                  {count > 0 ? `${count} ${plural(count)}` : "Разместить первым"}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </Box>
  )
}
