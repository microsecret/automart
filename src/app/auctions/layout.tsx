import type { Metadata } from "next"
import styles from "./auction-intro.module.css"

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
      <div className={styles.intro}>
        <h1 className={styles.title}>Автомобильные аукционы мира</h1>
        {/* Обещание совпадает с тем, что человек видит ниже.

            Прежний текст говорил «доставка и растаможка посчитаны для
            каждой машины», а карточка тридцатью пикселями ниже — «лот +
            комиссия · без пошлины и доставки». Расчёт под ключ на сайте
            действительно есть, но он на странице лота, а в списке стоит
            цена лота: разница доходит до миллиона рублей. Человек читал
            заголовок как «эти цифры итоговые» и обманывался. */}
        <p className={styles.lead}>
          Корея, Китай, Япония, Европа и США — в одном каталоге. В списке — цена лота
          с комиссией в рублях; доставка, пошлина и утильсбор считаются в карточке
          машины по курсу ЦБ.
        </p>
        {/* Три факта отдельными пунктами, а не перечислением через запятую:
            в сплошной строке глазу не за что зацепиться, и человек не видит,
            чем этот каталог отличается от чужой витрины. Разметка остаётся
            серверной — она нужна поисковику вместе с заголовком. */}
        <ul className={styles.facts}>
          <li data-tone="price">
            <span className={styles.icon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.7 5 3.3 5 1.4 5 3.4-2.2 3.3-5 3.3-5-1.2-5-3.1" />
              </svg>
            </span>
            <strong>Расчёт под ключ</strong>
            <span>В карточке машины: пошлина, утильсбор и доставка до вашего города</span>
          </li>
          <li data-tone="lots">
            <span className={styles.icon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                <circle cx="12" cy="12" r="3.4" />
                <path d="M7.5 5 9 2.6h6L16.5 5" />
              </svg>
            </span>
            <strong>Живые лоты площадок</strong>
            <span>Фотографии, пробег и состояние кузова — как в аукционном листе</span>
          </li>
          <li data-tone="delivery">
            <span className={styles.icon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 15.5V7.5a1 1 0 0 1 1-1h10v9M13.5 9.5h3.6l3.4 3.4v2.6" />
                <circle cx="7" cy="17" r="1.9" />
                <circle cx="17.5" cy="17" r="1.9" />
              </svg>
            </span>
            <strong>Доставка до России</strong>
            <span>Маршрут, сроки и таможенное оформление рассчитываем заранее</span>
          </li>
        </ul>
      </div>
      {children}
    </>
  )
}
