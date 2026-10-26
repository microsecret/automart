"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { IconArrowRight } from "@tabler/icons-react"
import { CREATE_VEHICLE_HREF } from "@/lib/navigation-registry"
import { tapFeedback } from "@/lib/telegram-webapp"

/**
 * Верх главного экрана приложения: круглые разделы и листаемые подборки.
 *
 * Раньше здесь стояли три белые плитки со значками, прилипшие к краям
 * экрана, — а машины начинались ниже середины. Ряд круглых разделов
 * знаком по любому приложению для телефона: он занимает одну строку, а
 * живые фотографии сразу говорят, что внутри. Подборки ниже — одна
 * карточка на экран, листаются пальцем, как витрина в магазине
 * приложений.
 */

type Story = { key: string; label: string; href: string; image: string; signedOnly?: boolean }

const STORIES: readonly Story[] = [
  { key: "auctions", label: "Аукционы", href: "/telegram?tab=auctions", image: "auctions" },
  { key: "sell", label: "Продать", href: `${CREATE_VEHICLE_HREF}?source=telegram`, image: "sell", signedOnly: true },
  { key: "parts", label: "Запчасти", href: "/catalogs?from=telegram", image: "parts" },
  { key: "fuel", label: "Заправки", href: "/services/fuel-map?from=telegram", image: "fuel" },
  { key: "history", label: "Проверка", href: "/services/history-check?from=telegram", image: "history" },
  { key: "garage", label: "Гараж", href: "/dashboard?tab=garage&from=telegram", image: "garage" },
  { key: "deliveries", label: "Доставка", href: "/dashboard/deliveries?from=telegram", image: "deliveries" },
]

/* Подборки. Тексты — только то, что площадка делает на самом деле:
   цена лота с комиссией и расчёт под ключ есть в карточке лота,
   размещение бесплатно, каталоги по маркам и карта АЗС работают. */
type Promo = { key: string; title: string; text: string; action: string; href: string; scene: string; tone: string; signedOnly?: boolean }

const PROMOS: readonly Promo[] = [
  { key: "auctions", title: "Авто из Кореи, Японии и Китая", text: "Цена лота с комиссией и расчёт под ключ", action: "Смотреть лоты", href: "/telegram?tab=auctions", scene: "auctions", tone: "teal" },
  { key: "sell", title: "Продайте машину здесь", text: "Объявление бесплатно, покупатели из Telegram и с сайта", action: "Разместить", href: `${CREATE_VEHICLE_HREF}?source=telegram`, scene: "sell", tone: "amber", signedOnly: true },
  { key: "parts", title: "Запчасти по марке и VIN", text: "Каталоги производителей и магазины", action: "Открыть каталоги", href: "/catalogs?from=telegram", scene: "part-engine", tone: "blue" },
  { key: "fuel", title: "Цены на АЗС рядом", text: "Карта заправок с актуальными ценами", action: "Открыть карту", href: "/services/fuel-map?from=telegram", scene: "fuel", tone: "coral" },
]

export default function TelegramHome({ signedIn, botUsername }: { signedIn: boolean; botUsername?: string }) {
  /* Без входа «Продать» вела бы в форму пароля — ведём в бота, где
     профиль заводится за три шага. */
  const resolve = (href: string, signedOnly?: boolean) =>
    signedOnly && !signedIn && botUsername ? `https://t.me/${botUsername}` : href

  return (
    <section className="tg-home" aria-label="Разделы и подборки">
      <nav className="tg-stories" aria-label="Быстрые разделы">
        {STORIES.map((story, index) => (
          <Link
            key={story.key}
            href={resolve(story.href, story.signedOnly)}
            className="tg-story"
            style={{ "--i": index } as React.CSSProperties}
            onClick={() => tapFeedback()}
          >
            <span className="tg-story__ring">
              {/* eslint-disable-next-line @next/next/no-img-element -- обложка 176 пикселей уже нарезана */}
              <img src={`/images/telegram/story-${story.image}-176.webp`} width={64} height={64} alt="" aria-hidden="true" decoding="async" />
            </span>
            <span className="tg-story__label">{story.label}</span>
          </Link>
        ))}
      </nav>

      <PromoCarousel resolve={resolve} />
    </section>
  )
}

function PromoCarousel({ resolve }: { resolve: (href: string, signedOnly?: boolean) => string }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  /* Точка под каруселью следует за пальцем: карточка, занявшая больше
     половины видимой полосы, считается текущей. Наблюдатель дешевле
     подсчёта на каждом событии прокрутки. */
  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setCurrent(Number((entry.target as HTMLElement).dataset.index))
      }
    }, { root: track, threshold: 0.6 })
    track.querySelectorAll<HTMLElement>(".tg-promo").forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [])

  const scrollTo = (index: number) => {
    const track = trackRef.current
    const card = track?.querySelectorAll<HTMLElement>(".tg-promo")[index]
    if (!track || !card) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft - 12, behavior: reduce ? "auto" : "smooth" })
  }

  return (
    <div className="tg-promos">
      <div className="tg-promos__track" ref={trackRef}>
        {PROMOS.map((promo, index) => (
          <Link
            key={promo.key}
            href={resolve(promo.href, promo.signedOnly)}
            className="tg-promo"
            data-tone={promo.tone}
            data-index={index}
            onClick={() => tapFeedback("medium")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- сцена уже нарезана в двух размерах */}
            <img
              className="tg-promo__scene"
              src={`/images/ui/scenic-v1/${promo.scene}-960.webp`}
              srcSet={`/images/ui/scenic-v1/${promo.scene}-960.webp 960w, /images/ui/scenic-v1/${promo.scene}-1600.webp 1600w`}
              sizes="(max-width: 640px) 88vw, 480px"
              alt=""
              aria-hidden="true"
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
            <span className="tg-promo__body">
              <span className="tg-promo__title">{promo.title}</span>
              <span className="tg-promo__text">{promo.text}</span>
              <span className="tg-promo__action">{promo.action}<IconArrowRight size={15} stroke={2.2} /></span>
            </span>
          </Link>
        ))}
      </div>
      <div className="tg-promos__dots" role="tablist" aria-label="Подборки">
        {PROMOS.map((promo, index) => (
          <button
            key={promo.key}
            type="button"
            role="tab"
            aria-selected={current === index}
            aria-label={promo.title}
            className="tg-promos__dot"
            data-active={current === index || undefined}
            onClick={() => scrollTo(index)}
          />
        ))}
      </div>
    </div>
  )
}
