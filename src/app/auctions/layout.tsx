import SectionArtworkHeader from "@/components/ui/SectionArtworkHeader"
import type { Metadata } from "next"
import "./auctions-page.css"
import styles from "./auction-intro.module.css"
import AuctionsIntroGate from "./AuctionsIntroGate"
import ServiceArtwork from "@/components/ui/ServiceArtwork"

/* Обновление задаётся здесь, а не в самой странице.

   В page.tsx стоит `export const dynamic = "force-dynamic"`, но файл
   начинается с "use client": в клиентском компоненте эта настройка не
   действует — Next читает её только в серверных. Из-за этого страница
   кэшировалась как полностью статическая, и боевой сайт отдавал
   `s-maxage=31536000`, то есть копию на год. Правки доходили до
   сервера, а люди видели прежнюю вёрстку.

   Шестьдесят секунд: выдача меняется не чаще, а посетитель и робот
   получают свежую разметку. */
export const revalidate = 60


export const metadata: Metadata = {
  title: "Автомобильные аукционы Кореи, Китая, Японии и Европы",
  description: "Актуальные автомобили зарубежных площадок в едином формате: фото, пробег, лот, цена источника, двигатель, комплектация, повреждения и расчёт доставки в Россию.",
  alternates: { canonical: "/auctions" },
  keywords: ["авто аукционы", "авто из Кореи", "авто из Китая", "авто из Японии", "авто из Европы", "аукционные автомобили", "доставка авто в Россию"],
  openGraph: {
    type: "website",
    url: "/auctions",
    title: "Автомобильные аукционы — LeWheel",
    description: "Предложения зарубежных автомобильных площадок с едиными характеристиками и расчётом стоимости.",
    images: [{ url: "/images/home/world-auctions.png", alt: "Зарубежные автомобильные аукционы LeWheel" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Автомобильные аукционы — LeWheel",
    description: "Авто из Кореи, Китая, Японии и Европы в одном каталоге.",
    images: ["/images/home/world-auctions.png"],
  },
}

/**
 * Заголовок раздела живёт здесь, а не на странице.
 *
 * Каталог аукционов — клиентский компонент, поэтому его разметка не попадала
 * в серверный HTML: поисковик получал 120 КБ страницы без единого заголовка
 * и без вводного текста. Метатеги это не заменяют — они описывают документ,
 * но не его содержимое. Серверный layout отдаёт h1 и вводку сразу, а живые
 * счётчики остаются на клиенте.
 */
export default function AuctionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuctionsIntroGate>
      <div className={styles.intro}>
        <SectionArtworkHeader scene="auctions" title="Автомобильные аукционы мира">
        {/* Обещание совпадает с тем, что человек видит ниже.

            Прежний текст говорил «доставка и растаможка посчитаны для
            каждой машины», а карточка тридцатью пикселями ниже — «лот +
            комиссия · без пошлины и доставки». Расчёт под ключ на сайте
            действительно есть, но он на странице лота, а в списке стоит
            цена лота: разница доходит до миллиона рублей. Человек читал
            заголовок как «эти цифры итоговые» и обманывался. */}
        <p className="auctions-intro__lead">
          Корея, Китай, Япония, Европа и США — в одном каталоге. В списке — цена лота
          с комиссией в рублях; доставка, пошлина и утильсбор считаются в карточке
          машины по курсу ЦБ.
        </p>
        </SectionArtworkHeader>
        {/* Три факта отдельными пунктами, а не перечислением через запятую:
            в сплошной строке глазу не за что зацепиться, и человек не видит,
            чем этот каталог отличается от чужой витрины. Разметка остаётся
            серверной — она нужна поисковику вместе с заголовком. */}
        <ul className={`${styles.facts} auctions-intro__facts`}>
          <li data-tone="price">
            <span className={styles.icon} aria-hidden="true"><ServiceArtwork kind="valuation" size={48} /></span>
            <strong>Расчёт под ключ</strong>
            <span>В карточке машины: пошлина, утильсбор и доставка до вашего города</span>
          </li>
          <li data-tone="lots">
            <span className={styles.icon} aria-hidden="true"><ServiceArtwork kind="history-check" size={48} /></span>
            <strong>Живые лоты площадок</strong>
            <span>Фотографии, пробег и состояние кузова — как в аукционном листе</span>
          </li>
          <li data-tone="delivery">
            <span className={styles.icon} aria-hidden="true"><ServiceArtwork kind="deliveries" size={48} /></span>
            <strong>Доставка до России</strong>
            <span>Маршрут, сроки и таможенное оформление рассчитываем заранее</span>
          </li>
        </ul>
      </div>
      </AuctionsIntroGate>
      {children}
    </>
  )
}
