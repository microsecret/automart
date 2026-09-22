"use client"

import Link from "next/link"
import NextImage from "next/image"
import useSWR from "swr"
import { Box, Group, Text } from "@mantine/core"
import { IconArrowRight } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { formatPriceShort } from "@/lib/format"
import { cleanModelLabel, isShowcaseReady } from "@/lib/auction-model-quality"

/**
 * Свежие лоты мировых аукционов на главной.
 *
 * Замер на боевом сервере: девять тысяч двести девяносто два аукционных
 * лота против двадцати объявлений в каталоге. Самое богатое, что есть у
 * площадки, пряталось за одной ссылкой в герое — человек читал «машины с
 * мировых аукционов», листал вниз и видел два десятка объявлений.
 *
 * Витрина показывает лоты, а не рассказывает о них: восемь машин с ценой
 * и страной. Это ровно то, ради чего сюда приходят, и это же лучший
 * ответ на вопрос «а есть ли тут вообще что-нибудь».
 */

type AuctionLot = {
  id: string
  make: string | null
  model: string | null
  year: number | null
  mileage: number | null
  finalPrice: number | null
  priceRub: number | null
  country: string | null
  imageUrl: string | null
}

type AuctionsResponse = {
  listings?: AuctionLot[]
  pagination?: { total?: number }
}

const COUNTRY_LABELS: Record<string, string> = {
  JP: "Япония",
  KR: "Корея",
  CN: "Китай",
  US: "США",
  EU: "Европа",
  DE: "Германия",
}

/* Восемь лотов: четыре в ряд на широком экране, два на планшете и лента
   на телефоне. Больше — и блок начинает соперничать с самим каталогом,
   меньше — не читается как витрина. */
const VISIBLE_LOTS = 8

export default function AuctionShowcase() {
  /* Запрашиваем с запасом, а отбираем ровно восемь.

     Лоты без снимка отсеиваются ниже. Если просить у сервера ровно
     восемь, после отсева останется шесть или семь, и ряд поредеет на
     пустое место. Запас в половину покрывает эту убыль: безфотографийных
     в базе 84 из 15 726, то есть один процент, и двенадцати заведомо
     хватает, чтобы набрать восемь. */
  const { data } = useSWR<AuctionsResponse>(`/api/auctions?limit=${VISIBLE_LOTS + 4}&view=brief`, fetchJson, {
    /* Лоты обновляются раз в несколько часов сбором, а не ежеминутно:
       перезапрашивать их при каждом возврате на вкладку незачем. */
    revalidateOnFocus: false,
  })

  /* Лот без снимка в витрину не попадает.

     Витрина существует, чтобы показать машины, а не перечислить их. На
     главной было две карточки подряд с пустым серым прямоугольником
     вместо фотографии — «Daihatsu haizettokago» без единого снимка. В
     каталоге такой лот уместен: человек пришёл за списком и сам решит,
     писать ли продавцу. В витрине из четырёх карточек пустая забирает
     четверть блока и говорит, что показывать нечего.

     Причина пустых снимков внешняя и кодом не лечится: прокси для
     съёмки CarSensor не работают, часть лотов приезжает без картинок. */
  const lots = (data?.listings ?? [])
    .filter((lot) => isShowcaseReady(lot) && lot.imageUrl)
    .slice(0, VISIBLE_LOTS)
  const total = data?.pagination?.total ?? 0

  /* Пока лотов нет, блока нет вовсе: пустая витрина на главной хуже её
     отсутствия — она говорит, что площадка не работает. */
  if (!lots.length) return null

  return (
    <Box className="auction-showcase" component="section" aria-label="Свежие лоты мировых аукционов">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="md">
        <Box>
          <Text component="h2">
            С мировых аукционов
          </Text>
          <Text size="sm" c="dimmed">
            {total > 0
              ? `${total.toLocaleString("ru-RU")} живых лотов из Японии, Кореи, Китая, США и Европы`
              : "Лоты из Японии, Кореи, Китая, США и Европы"}
          </Text>
        </Box>
        <Link href="/auctions" className="auction-showcase__all">
          Все лоты
          <IconArrowRight size={15} />
        </Link>
      </Group>

      <Box className="auction-showcase__grid">
        {lots.map((lot) => {
          const price = lot.finalPrice ?? lot.priceRub
          const country = lot.country ? COUNTRY_LABELS[lot.country] ?? lot.country : null

          return (
            <Link key={lot.id} href={`/auctions/${lot.id}`} className="auction-showcase__card">
              <Box className="auction-showcase__media">
                {lot.imageUrl ? (
                  <NextImage
                    src={lot.imageUrl}
                    alt={`${lot.make ?? ""} ${lot.model ?? ""}`.trim()}
                    fill
                    sizes="(max-width: 640px) 60vw, (max-width: 1024px) 33vw, 25vw"
                    className="auction-showcase__image"
                    /* Фото лота отдаётся напрямую, без оптимизатора.
                     *
                     * Он отводит на загрузку исходника семь секунд — это
                     * зашито в Next (`image-optimizer.js`), настройкой не
                     * меняется. Замер с сервера: CarSensor отдаёт снимок за
                     * 25 секунд, youxinpai не укладывается тоже, и в логе
                     * идёт «upstream image response timed out». На витрине
                     * главной из-за этого не показывались четыре лота из
                     * восьми — вместо машин пустые прямоугольники.
                     *
                     * Прямая отдача тяжелее, но лот виден. Снимки площадок
                     * и так отдаются уменьшенными: это их превью для
                     * каталога, а не оригиналы с камеры. */
                    unoptimized
                  />
                ) : (
                  <Box className="auction-showcase__media-empty" aria-hidden="true" />
                )}
                {country && <span className="auction-showcase__country">{country}</span>}
              </Box>

              <Box className="auction-showcase__body">
                {/* Цена первой строкой: листая витрину, человек сравнивает
                    цены, а не названия. */}
                <Text className="auction-showcase__price">
                  {price ? formatPriceShort(price) : "Цена по запросу"}
                </Text>
                <Text className="auction-showcase__title" lineClamp={1}>
                  {[lot.make, cleanModelLabel(lot.model)].filter(Boolean).join(" ")}
                </Text>
                <Text className="auction-showcase__meta">
                  {[
                    lot.year ? `${lot.year}` : null,
                    lot.mileage ? `${Math.round(lot.mileage / 1000)} тыс. км` : null,
                  ].filter(Boolean).join(" · ") || " "}
                </Text>
              </Box>
            </Link>
          )
        })}
      </Box>
    </Box>
  )
}
