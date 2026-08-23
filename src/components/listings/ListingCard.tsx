"use client"

import { useState, useEffect } from "react"
import { Card, Text, Group, Badge, Box, ActionIcon, AspectRatio, UnstyledButton } from "@mantine/core"
import { IconEye, IconHeart, IconMapPin, IconScale } from "@tabler/icons-react"
import Link from "next/link"
import { formatMonthlyPayment, formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import { findLabel, getFuelOptions, getTransmissionOptions, getUsageMeta, supportsTransmission } from "@/lib/constants"
import BrandIcon from "@/components/brands/BrandIcon"
import { hasBrandLogo } from "@/components/brands/BrandLogo"
import VehicleFallback from "./VehicleFallback"
import NextImage from "next/image"
import { COMPARE_LIMIT, readCompareList, toggleCompare } from "@/lib/compare-list"
import { useFavorites } from "@/hooks/useFavorites"
import { notifications } from "@mantine/notifications"

export interface ListingCardData {
  id: string
  title: string
  price: number | null
  isFeatured?: boolean
  createdAt?: string | Date
  location?: string | null
  views?: number
  vehicle?: {
    id: string
    make: string
    model: string
    year: number
    mileage: number | null
    operatingHours?: number | null
    flightHours?: number | null
    fuelType: string | null
    transmission: string | null
    bodyType: string | null
    images: string | null
    vehicleType?: string | null
    typeDetails?: string | null
  } | null
  part?: {
    id: string
    name: string
    price: number
    condition: string | null
    partType: string | null
    images: string | null
  } | null
}

const TRUNCATE_STYLE: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "block",
  maxWidth: "100%",
}

export default function ListingCard({ listing }: { listing: ListingCardData }) {
  const [activeImg, setActiveImg] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const { favoriteIds, isAuthenticated, isPending, toggleFavorite } = useFavorites()
  useEffect(() => {
    setActiveImg(0)
    setImageFailed(false)
    setImageLoaded(false)
  }, [listing.id])
  const isVehicle = !!listing.vehicle
  const detailHref = isVehicle
    ? `/listings/vehicle/${listing.vehicle!.id}`
    : `/listings/part/${listing.part!.id}`

  const images = parseImages(isVehicle ? listing.vehicle!.images : listing.part?.images)
  const sourceImage = images[0] || ""
  const image = sourceImage.includes("/placeholder/") ? "" : sourceImage
  const activeImage = images[activeImg] || image
  const displayImage = imageFailed || activeImage.includes("/placeholder/") ? "" : activeImage
  const hasDisplayImage = Boolean(displayImage)
  // Объявление считается свежим первые сутки: за этот срок его ещё не видели
  // те, кто заходит на площадку раз в день.
  const [inCompare, setInCompare] = useState(false)

  // Список живёт в браузере, поэтому его состояние читается после отрисовки
  // и обновляется, когда машину добавили из другой карточки.
  useEffect(() => {
    const sync = () => setInCompare(readCompareList().includes(listing.id))
    sync()
    window.addEventListener("compare-list-changed", sync)
    return () => window.removeEventListener("compare-list-changed", sync)
  }, [listing.id])

  const handleCompare = (event: React.MouseEvent) => {
    // Карточка — ссылка: без остановки нажатие открыло бы объявление.
    event.preventDefault()
    event.stopPropagation()
    const result = toggleCompare(listing.id)
    setInCompare(result.ids.includes(listing.id))
    if (result.limitReached) {
      notifications.show({
        title: "В сравнении уже четыре машины",
        message: "Уберите одну из списка, чтобы добавить эту.",
        color: "orange",
      })
      return
    }
    notifications.show({
      title: result.added ? "Добавлено к сравнению" : "Убрано из сравнения",
      message: result.added
        ? `В сравнении ${result.ids.length} из ${COMPARE_LIMIT} — откройте раздел «Сравнение», когда наберёте нужные.`
        : "Машина больше не участвует в сравнении.",
      color: result.added ? "indigo" : "gray",
    })
  }

  const isFresh = Boolean(
    listing.createdAt && Date.now() - new Date(listing.createdAt).getTime() < 86_400_000,
  )
  // Сдвиг для счётчика фото и подписи: каждая метка занимает свою ширину,
  // иначе при двух метках счётчик оказывался бы поверх них.
  const tagsOffset = 8 + (listing.isFeatured ? 76 : 0) + (isFresh ? 78 : 0)

  const monthlyPayment = formatMonthlyPayment(listing.price)
  const vehicleType = listing.vehicle?.vehicleType || "CAR"
  const usageMeta = getUsageMeta(vehicleType)
  const usageValue = usageMeta.field === "flightHours" ? listing.vehicle?.flightHours
    : usageMeta.field === "operatingHours" ? listing.vehicle?.operatingHours
    : listing.vehicle?.mileage
  const numericUsage = typeof usageValue === "number" && Number.isFinite(usageValue) ? usageValue : null
  const distanceValue = numericUsage == null ? "Не указано"
    : usageMeta.field === "mileage" ? formatMileage(numericUsage)
    : `${new Intl.NumberFormat("ru-RU").format(numericUsage)} ${usageMeta.unit}`
  const showBrandMark = isVehicle && hasBrandLogo(listing.vehicle!.make)
  const isFav = favoriteIds.has(listing.id)
  const missingMediaLabel = "Без фото"

  const toggleFav = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      notifications.show({
        title: "Войдите, чтобы сохранить",
        message: "Избранное синхронизируется между сайтом и Telegram после входа.",
        color: "indigo",
        autoClose: 7000,
      })
      return
    }

    void toggleFavorite(listing.id)
  }

  return (
    <Card
        className="listing-card"
        data-vehicle-type={isVehicle ? vehicleType.toLowerCase() : "part"}
        pos="relative"
        padding={0}
        radius="md"
        withBorder
        style={{
          overflow: "hidden",
          borderColor: "var(--market-line)",
          transition: "border-color 200ms ease, box-shadow 200ms ease",
          cursor: "pointer",
        }}
      >
        <Link href={detailHref} aria-label={`Открыть объявление: ${listing.title}`} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
        {/* Фото область */}
        <Box
          className="listing-card__media"
          data-empty-media={!hasDisplayImage || undefined}
          data-image-loading={hasDisplayImage && !imageLoaded ? "true" : undefined}
          data-vehicle-type={isVehicle ? vehicleType.toLowerCase() : "part"}
          pos="relative"
          style={{ background: "var(--market-surface-subtle)", lineHeight: 0 }}
        >
          {/* Область фото поднята над общим оверлеем карточки — иначе
              кнопки «в сравнение» и «в избранное» не нажимались вовсе.
              Переход по клику на само фото задаётся этой ссылкой: она
              лежит под кнопками и над изображением. */}
          <Link
            href={detailHref}
            className="listing-card__media-link"
            aria-hidden="true"
            tabIndex={-1}
          />
          <AspectRatio ratio={5 / 4}>
            <>
              <VehicleFallback type={isVehicle ? vehicleType : "PART"} bodyType={listing.vehicle?.bodyType} compact={!hasDisplayImage} />
              {displayImage && (
              /* Оптимизированная картинка вместо оригинала.

                 Замер показал: снимки из /uploads отдавались как есть —
                 4032×3024 весом 4 МБ в слот 382×306. Главная весила
                 10.3 МБ, из них 7.8 МБ приходилось на шесть фотографий.

                 sizes описывает реальную ширину слота: на телефоне карточка
                 занимает всю ширину, на планшете половину, на широком экране
                 четверть. По этим числам Next отдаёт подходящий размер, а не
                 оригинал. */
              <NextImage
                className="listing-card__image"
                data-loaded={imageLoaded || undefined}
                src={displayImage}
                alt={listing.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                onLoad={() => setImageLoaded(true)}
                onError={() => { setImageFailed(true); setImageLoaded(false) }}
                loading="lazy"
              />
              )}
            </>
          </AspectRatio>
          {images.length > 1 && (
            <>
              {/* Точки навигации */}
              {/* Точка остаётся маленькой визуально, но зона нажатия — 44px,
                  как требует норма для пальца: попасть в шестипиксельную
                  цель на телефоне невозможно. Зона уходит вверх от нижнего
                  края карточки и не мешает нажатию на саму карточку. */}
              <Box pos="absolute" bottom={0} left={0} right={0} style={{ display: "flex", justifyContent: "center", gap: 2, zIndex: 2 }}>
                {images.slice(0, 5).map((_, i) => (
                  <UnstyledButton
                    key={i}
                    onClick={() => { setActiveImg(i); setImageFailed(false); setImageLoaded(false) }}
                    aria-label={`Показать фото ${i + 1} из ${images.length}`}
                    aria-current={i === activeImg ? "true" : undefined}
                    style={{
                      display: "grid",
                      // Точка прижата к низу зоны: сама зона высотой 44px
                      // растёт вверх на изображение, где нажимать не по чему.
                      placeItems: "end center",
                      width: 44,
                      height: 44,
                      paddingBottom: 6,
                      cursor: "pointer",
                    }}
                  >
                    {/* Активная точка растягивается через transform: анимация
                        width заставляла браузер пересчитывать раскладку на
                        каждом кадре, а карточек в каталоге десятки. */}
                    <Box
                      style={{
                        width: 16,
                        height: 6,
                        borderRadius: 3,
                        background: i === activeImg ? "#fff" : "rgba(255,255,255,0.55)",
                        boxShadow: "0 0 2px rgba(0,0,0,.45)",
                        transform: i === activeImg ? "scaleX(1)" : "scaleX(0.375)",
                        transition: "transform var(--ease-base) ease, background var(--ease-base) ease",
                      }}
                    />
                  </UnstyledButton>
                ))}
              </Box>
              {/* Счётчик фото */}
              <Box pos="absolute" top={8} left={tagsOffset} style={{ background: "rgba(0,0,0,0.6)", borderRadius: 4, padding: "2px 6px", zIndex: 2 }}>
                <Text fz={10} c="white" fw={500}>{activeImg + 1}/{images.length}</Text>
              </Box>
            </>
          )}

          {/* Метки состояния — слева сверху.

              Показываем только то, что действительно известно про объявление:
              выделенное продавцом и свежее (меньше суток). Придумывать
              «проверено» или «срочно» там, где таких данных нет, нельзя —
              метка перестанет что-либо значить. */}
          {(listing.isFeatured || isFresh) && (
            <Box pos="absolute" top={8} left={8} style={{ zIndex: 2, display: "flex", gap: 4 }}>
              {listing.isFeatured && <span className="market-tag" data-tag="featured">Премиум</span>}
              {isFresh && <span className="market-tag" data-tag="new">Сегодня</span>}
            </Box>
          )}

          {!hasDisplayImage && (
            <Box pos="absolute" top={8} left={tagsOffset} style={{ zIndex: 2 }}>
              <Badge className="listing-card__media-label" color="gray" variant="white" size="xs" radius="sm">{missingMediaLabel}</Badge>
            </Box>
          )}

          {/* Цветная иконка бренда — справа сверху */}
          {showBrandMark && (
            <Box pos="absolute" top={8} right={8} style={{ zIndex: 2 }}>
              <BrandIcon brand={listing.vehicle!.make} size={28} variant="rounded" />
            </Box>
          )}

          {/* Сравнение — рядом с избранным.

              Страница сравнения на сайте была, но попасть в неё можно было
              только вручную через адрес: в карточке кнопки не было. Человек,
              который выбирает между тремя машинами, держал их в закладках.

              Только для транспорта: сравнивать запчасти по характеристикам
              нечего. */}
          {isVehicle && (
            <Box pos="absolute" bottom={8} right={56} style={{ zIndex: 2 }}>
              <ActionIcon
                className="listing-card__favorite"
                color={inCompare ? "indigo" : "dark"}
                variant="filled"
                size={44}
                radius="xl"
                onClick={handleCompare}
                aria-label={inCompare ? "Убрать из сравнения" : "Добавить к сравнению"}
                style={{ opacity: 0.9 }}
              >
                <IconScale size={15} />
              </ActionIcon>
            </Box>
          )}

          {/* Сердечко — справа снизу */}
          <Box pos="absolute" bottom={8} right={8} style={{ zIndex: 2 }}>
            <ActionIcon
              className="listing-card__favorite"
              color={isFav ? "red" : "dark"}
              variant="filled"
              /* 44px — норма зоны нажатия для пальца; при size="sm" кнопка
                 была 30px и на телефоне в неё промахивались. Размер задан
                 числом: именованные ступени Mantine до 44px не доходят
                 (lg — это 34px). Само сердечко осталось прежним. */
              size={44}
              radius="xl"
              onClick={toggleFav}
              loading={isPending(listing.id)}
              aria-label={isFav ? "Убрать из избранного" : "Добавить в избранное"}
              style={{ opacity: 0.9 }}
            >
              <IconHeart size={14} fill={isFav ? "currentColor" : "none"} />
            </ActionIcon>
          </Box>
        </Box>

        {/* Текстовая область — чёткое разделение */}
        <Box p="sm" className="listing-card__content">
          {/* Цена + цена в месяц */}
          <Group justify="space-between" align="baseline" mb={4}>
            {/* Цена — главное в карточке: раньше она была 16px против 14px
                у названия, и разницу в два пикселя глаз не различал. */}
            <Text className="listing-card__price" fw={800} fz={22} lh={1.05} c="var(--market-ink)" ff="var(--font-display),sans-serif" style={{ letterSpacing: "var(--track-title)", fontVariantNumeric: "tabular-nums" }}>
              {formatPriceShort(listing.price)}
            </Text>
            {monthlyPayment && (
              <Text className="listing-card__monthly-payment" fz="10px" c="var(--market-muted)" style={{ whiteSpace: "nowrap" }}>
                {monthlyPayment}
              </Text>
            )}
          </Group>

          {/* Заголовок */}
          <Text className="listing-card__title" fz="sm" fw={600} c="var(--market-text-secondary)" lh={1.3} mb={7}>
            {listing.title}
          </Text>

          {/* Краткие факты: без капслока и повторения типа категории.
              Раскладка — поток, а не жёсткие две колонки: при нечётном числе
              фактов (у машины без пробега их три) справа внизу зияла пустая
              ячейка. */}
          {isVehicle && (
            <Box mb={6} className="listing-card__facts">
              <Text className="listing-card__fact" fz="xs" fw={600} c="var(--market-ink)">{listing.vehicle!.year}</Text>
              {numericUsage != null && <Text className="listing-card__fact" fz="xs" fw={600} c="var(--market-ink)">{distanceValue}</Text>}
              {/* Чип несёт значение без подписи: «2008», «85 000 км»,
                  «автомат» — что это, понятно по самому значению, а слова
                  «Год» и «КПП» занимали половину узкого чипа.

                  OTHER не показываем: «КПП Другая» означает, что данных нет,
                  и в списке это не факт. В самом объявлении оно остаётся. */}
              {supportsTransmission(vehicleType) && listing.vehicle!.transmission && listing.vehicle!.transmission !== "OTHER" && <Text className="listing-card__fact" fz="xs" fw={600} c="var(--market-ink)">{findLabel(getTransmissionOptions(vehicleType), listing.vehicle!.transmission)}</Text>}
              {listing.vehicle!.fuelType && listing.vehicle!.fuelType !== "OTHER" && <Text className="listing-card__fact" fz="xs" fw={600} c="var(--market-ink)">{findLabel(getFuelOptions(vehicleType), listing.vehicle!.fuelType)}</Text>}
            </Box>
          )}

          {/* Низ — город и дата */}
          <Group justify="space-between" gap={4} mt={6} pt={6} className="listing-card__footer">
            {listing.location ? (
              <Group gap={3} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <IconMapPin size={11} stroke={1.8} color="gray.4" style={{ flexShrink: 0 }} />
                <Text fz="xs" c="var(--market-muted)" style={TRUNCATE_STYLE}>{listing.location}</Text>
              </Group>
            ) : <span />}
            <Group gap={7} wrap="nowrap" style={{ flexShrink: 0 }}>
              {typeof listing.views === "number" && listing.views > 0 && (
                <Group gap={3} wrap="nowrap" className="listing-card__views">
                  <IconEye size={11} stroke={1.8} aria-hidden="true" />
                  <Text fz="xs">{new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(listing.views)}</Text>
                </Group>
              )}
              {/* У свежего объявления дату в подвале не повторяем: метка
                  «Сегодня» вверху уже это сказала, а строка отнимала место у
                  города — длинные названия обрезались на середине. */}
              {listing.createdAt && !isFresh && (
                <Text fz="xs" c="var(--market-muted)" style={{ whiteSpace: "nowrap" }}>
                  {formatRelativeDate(listing.createdAt)}
                </Text>
              )}
            </Group>
          </Group>
        </Box>
      </Card>
  )
}
