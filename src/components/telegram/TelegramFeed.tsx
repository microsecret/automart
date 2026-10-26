"use client"

import { useDeferredValue, useMemo, useState } from "react"
import Link from "next/link"
import NextImage from "next/image"
import { shouldBypassOptimizer } from "@/lib/uploaded-image"
import useSWR from "swr"
import { Badge, Box, Button, Group, Stack, Text, TextInput } from "@mantine/core"
import { IconEye, IconMapPin, IconPhotoOff, IconSearch, IconX } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import MiniArt from "./MiniArt"
import { formatMileage, formatPriceShort } from "@/lib/format-numbers"
import { parseImages } from "@/lib/format"

/**
 * Лента машин в приложении Telegram.
 *
 * Раньше приложение открывалось экраном приветствия со списком ссылок по
 * группам: человек входил и упирался в меню, не увидев ни одной машины.
 * Продавец не понимал, что здесь вообще продают, а покупатель уходил.
 *
 * Здесь товар с первого экрана — как в любом мобильном приложении
 * маркетплейса. Карточка сжата до того, по чему принимают решение
 * листая: фотография, цена, название, год и пробег.
 */

type FeedVehicle = {
  id: string
  make: string
  model: string
  year: number
  mileage: number | null
  images: string | null
  location: string | null
  vehicleType?: string | null
}

type FeedListing = {
  id: string
  title: string
  price: number | null
  createdAt?: string
  /* Просмотры приходят от /api/listings, но лента их выбрасывала: на
     сайте и в ленте новостей счётчик есть, а у машины не было — внутри
     одного приложения похожие карточки говорили разное. Для молодой
     площадки это ещё и единственный видимый признак жизни. */
  views?: number
  vehicle?: FeedVehicle | null
}

type FeedResponse = { listings: FeedListing[]; pagination?: { total: number } }

/** Сколько машин показывать: экран телефона вмещает три-четыре карточки. */
const FEED_LIMIT = 24

/* Типы техники лентой кнопок.

   Проп vehicleType в этом компоненте был написан и обрабатывался, но
   никто его не передавал: фильтр существовал только в коде. В ленте
   вперемешку шли легковые, мотоциклы и грузовики, а отделить их было
   нечем — на сайте для этого есть отдельные страницы категорий, в
   мини-приложении не было ничего.

   Порядок по спросу: легковые ищут чаще всего, воздушный транспорт —
   единицы, и он уезжает за край прокручиваемой ленты. */
/* У каждого типа свой объёмный значок — тот же, что в каталоге сайта:
   плитка со значком узнаётся боковым зрением быстрее подписи. */
const FEED_TYPES = [
  { value: "", label: "Все", art: "all" },
  { value: "cars", label: "Легковые", art: "cars" },
  { value: "moto", label: "Мото", art: "moto" },
  { value: "trucks", label: "Грузовики", art: "trucks" },
  { value: "special", label: "Спецтехника", art: "special" },
  { value: "water", label: "Водный", art: "water" },
  { value: "air", label: "Воздушный", art: "air" },
] as const

export default function TelegramFeed({ vehicleType }: { vehicleType?: string }) {
  const [search, setSearch] = useState("")
  /* Выбор человека важнее того, что пришло пропом: проп задаёт начальный
     раздел, дальше лента слушается кнопок. */
  const [pickedType, setPickedType] = useState(vehicleType || "")
  /* Запрос уходит с задержкой относительно набора: иначе каждая буква
     отправляла бы запрос, а на телефоне это ещё и заметная задержка
     отрисовки при медленной сети. */
  const deferredSearch = useDeferredValue(search.trim())

  const query = new URLSearchParams({ type: "vehicle", limit: String(FEED_LIMIT), sort: "newest" })
  if (pickedType) query.set("vehicleType", pickedType)
  if (deferredSearch.length > 1) query.set("q", deferredSearch)

  const { data, error, isLoading, isValidating, mutate } = useSWR<FeedResponse>(`/api/listings?${query}`, fetchJson, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const searchField = (
    <Box className="tg-search">
      <TextInput
        className="tg-search__input"
        placeholder="Марка, модель или город"
        aria-label="Поиск по объявлениям"
        leftSection={<IconSearch size={16} />}
        rightSection={
          search ? (
            <button
              type="button"
              className="tg-search__clear"
              onClick={() => setSearch("")}
              aria-label="Очистить поиск"
            >
              <IconX size={14} />
            </button>
          ) : null
        }
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        size="md"
      />
    </Box>
  )

  /* Плитки типов прокручиваются вбок и уходят вверх вместе с лентой:
     липким остаётся только поиск. Плитки со значками выше кнопок, и
     липкая полоса из двух рядов отняла бы у ленты треть экрана. */
  const typeTiles = (
    <Box className="tg-kinds" role="group" aria-label="Тип техники">
      {FEED_TYPES.map((item) => (
        <button
          key={item.value || "all"}
          type="button"
          className="tg-kind"
          data-active={pickedType === item.value || undefined}
          aria-pressed={pickedType === item.value}
          onClick={() => {
            window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.()
            setPickedType(item.value)
          }}
        >
          <span className="tg-kind__art"><MiniArt kind={item.art} size={34} /></span>
          <span className="tg-kind__label">{item.label}</span>
        </button>
      ))}
    </Box>
  )

  if (isLoading) {
    return (
      <>
        {searchField}
        {typeTiles}
        {/* Заготовки карточек вместо спиннера: человек сразу видит, что
            здесь будет лента, и экран не прыгает, когда она приходит. */}
        <Stack gap="var(--tg-card-gap)" className="tg-feed" aria-busy="true" aria-label="Загружаем объявления">
          {[0, 1].map((key) => (
            <Box key={key} className="tg-card tg-card--skeleton">
              <Box className="tg-card__media tg-skeleton" />
              <Box className="tg-card__body">
                <span className="tg-skeleton tg-skeleton--line" style={{ width: "38%" }} />
                <span className="tg-skeleton tg-skeleton--line" style={{ width: "72%" }} />
              </Box>
            </Box>
          ))}
        </Stack>
      </>
    )
  }

  const listings = data?.listings || []
  const searching = deferredSearch.length > 1

  /* Сбой запроса — не то же самое, что пустой раздел.

     Ошибка из SWR не бралась вовсе: упавший запрос давал пустые данные,
     и человек видел «Пока пусто. В этом разделе ещё нет объявлений».
     В мобильной сети это случается регулярно, и вывод получался
     противоположный правде — «площадка пустая», после чего человек
     уходит. Повторить было нечем: кнопки нет, обновления по возврату
     на вкладку тоже. */
  if (error) {
    return (
      <>
        {searchField}
        {typeTiles}
        <Stack align="center" py={48} gap={10}>
          <Text fw={700} c="var(--tg-text)">Не удалось загрузить</Text>
          <Text size="xs" c="var(--tg-hint)" ta="center" maw={270}>
            Проверьте связь и попробуйте ещё раз — объявления никуда не делись.
          </Text>
          <Button size="sm" className="tg-button" onClick={() => void mutate()}>Повторить</Button>
        </Stack>
      </>
    )
  }

  if (!listings.length) {
    return (
      <>
        {searchField}
        {typeTiles}
        <Stack align="center" py={48} gap={6}>
          <Text fw={700} c="var(--tg-text)">
            {searching ? "Ничего не нашлось" : "Пока пусто"}
          </Text>
          <Text size="xs" c="var(--tg-hint)" ta="center" maw={270}>
            {searching
              ? "Попробуйте другое название или проверьте раскладку."
              : "В этом разделе ещё нет объявлений. Разместите первым — это бесплатно."}
          </Text>
        </Stack>
      </>
    )
  }

  return (
    <>
      {searchField}
      {typeTiles}
      {/* Выдача приглушается на время обновления, а не подменяется молча:
          человек набирает запрос и видит, что идёт работа, не теряя
          прежний результат из виду. */}
      <Stack gap="var(--tg-card-gap)" pb={8} className="tg-feed" data-updating={isValidating || undefined}>
        {listings.map((listing, index) => (
          <TelegramFeedCard key={listing.id} listing={listing} index={index} />
        ))}
      </Stack>
    </>
  )
}

function TelegramFeedCard({ listing, index }: { listing: FeedListing; index: number }) {
  const [failed, setFailed] = useState(false)
  const vehicle = listing.vehicle
  const image = useMemo(() => parseImages(vehicle?.images)[0] || null, [vehicle?.images])

  /* Отклик при переходе — то, чем приложение отличается от страницы.

     Лёгкий, не средний: переход по карточке случается часто, и сильный
     отклик на частом действии быстро надоедает. */
  const tap = () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")

  const isFresh = Boolean(
    listing.createdAt && Date.now() - new Date(listing.createdAt).getTime() < 86_400_000,
  )

  return (
    <Box
      component={Link}
      href={`/listings/vehicle/${vehicle?.id || listing.id}?from=telegram`}
      onClick={tap}
      className="tg-card"
      /* Порядковый номер задаёт задержку въезда: первые карточки
         появляются друг за другом, дальние — без ожидания. */
      style={{ "--i": Math.min(index, 6) } as React.CSSProperties}
    >
      <Box className="tg-card__media">
        {image && !failed ? (
          /* Через оптимизатор: оригиналы из /uploads весили по 130–280 КБ,
             и главная картинка экрана на телефоне появлялась через 1.8 с.
             Первая карточка грузится сразу — она и есть главная картинка. */
          <NextImage
            src={image}
            alt={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : listing.title}
            fill
            /* Около двух пикселей на точку: на экране x3 версия 1080 весила
               до 164 КБ, а разницы в карточке шириной 390 точек не видно. */
            sizes="(min-width: 640px) 320px, 70vw"
            quality={68}
            priority={index === 0}
            unoptimized={shouldBypassOptimizer(image)}
            onError={() => setFailed(true)}
          />
        ) : (
          <Box className="tg-card__media-empty">
            <IconPhotoOff size={22} />
          </Box>
        )}
        {isFresh && <Badge className="tg-card__badge" data-fresh size="xs">Сегодня</Badge>}
      </Box>

      <Box className="tg-card__body">
        <Text className="tg-card__price">{formatPriceShort(listing.price)}</Text>
        <Text className="tg-card__title" lineClamp={1}>
          {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : listing.title}
        </Text>
        {/* Строка переносится, а не сжимается.

            С запретом переноса третий элемент на узком экране съедал
            город: на 320 пикселях под строку остаётся меньше трёхсот, и
            «Петропавловск-Камчатский» обрезался многоточием. Перенос
            честнее — лучше вторая строка, чем половина названия. */}
        <Group gap="4 8" wrap="wrap" className="tg-card__facts">
          {vehicle?.mileage != null && <span>{formatMileage(vehicle.mileage)}</span>}
          {vehicle?.location && (
            <span className="tg-card__place">
              <IconMapPin size={11} />
              {vehicle.location}
            </span>
          )}
          {typeof listing.views === "number" && listing.views > 0 && (
            <span className="tg-card__stat">
              <IconEye size={11} />
              {listing.views.toLocaleString("ru-RU")}
            </span>
          )}
        </Group>
      </Box>
    </Box>
  )
}
