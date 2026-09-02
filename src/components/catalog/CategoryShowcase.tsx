"use client"

import { plural as sharedPlural } from "@/lib/format"
import Link from "next/link"
import useSWR from "swr"
import { Box, Group, Paper, SimpleGrid, Text, ThemeIcon } from "@mantine/core"
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

  return (
    <Box component="section" className={styles.showcase} aria-label="Направления каталога">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="xs" mb="sm">
        <Box>
          <Text component="h2" className={styles.title}>Выберите направление</Text>
          <Text className={styles.subtitle}>Транспорт и запчасти в одном каталоге. Проверка, доставка и сопровождение сделки.</Text>
        </Box>
      </Group>

      {/* Семь колонок — только там, где им хватает места.

          Сетка считает пороги по ширине окна, а не контейнера, и рядом с
          боковым меню в 236 пикселей контенту достаётся заметно меньше:
          на экране 1280 карточка выходила по 136 пикселей, подсказки под
          названиями ложились в три строки и колонки вытягивались.

          Порог перенесён на 1440 — там даже с меню остаётся простор; между
          планшетом и этой шириной идут пять колонок. */}
      <SimpleGrid cols={{ base: 2, sm: 4, lg: 5, xl: 7 }} spacing="xs" className={styles.grid}>
        {DIRECTIONS.map(({ slug, href, label, hint, Icon, tone }) => {
          const count = counts?.[slug]
          return (
            <Paper
              key={slug}
              component={Link}
              href={href}
              className={styles.card}
              data-tone={tone}
              radius="lg"
              p="sm"
              withBorder
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                <ThemeIcon variant="light" color={tone} size={34} radius="xl" className={styles.icon}>
                  <Icon size={17} stroke={1.9} />
                </ThemeIcon>
                {/* Пока счётчики грузятся, места под них не занимаем —
                    иначе карточки дёргаются при появлении чисел.

                    Пустая категория показывает не «0», а точку: цифра ноль
                    читается как «здесь ничего нет и не будет», хотя раздел
                    работает и ждёт первое объявление. Пять нулей из семи
                    плиток на главном экране отпугивали покупателя раньше,
                    чем он успевал посмотреть каталог. */}
                {typeof count === "number" && count > 0 && (
                  <Text className={styles.count}>{count}</Text>
                )}
              </Group>
              <Text className={styles.label}>{label}</Text>
              <Text className={styles.hint}>{hint}</Text>
              {/* Нижняя строка есть всегда, пока счётчики загружены.

                  Раньше у раздела без объявлений она просто отсутствовала —
                  под названием оставался воздух, и плитка выглядела
                  недоделанной рядом с заполненной соседкой. Разной высоты
                  строк в одном ряду достаточно, чтобы весь ряд читался как
                  незавершённый.

                  Стиль для этого случая в модуле уже был написан
                  (.meta[data-empty]), но его никто не применял. */}
              {typeof count === "number" && (
                count > 0
                  ? <Text className={styles.meta}>{count} {plural(count)}</Text>
                  : <Text className={styles.meta} data-empty="true">Разместить первым</Text>
              )}
            </Paper>
          )
        })}
      </SimpleGrid>
    </Box>
  )
}
