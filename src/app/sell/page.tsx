import type { Metadata } from "next"
import {
  IconBellRinging, IconBuildingStore, IconFileSpreadsheet, IconMessageCircle, IconSearch,
  IconShieldCheck, IconTruckDelivery, IconWorldWww,
} from "@tabler/icons-react"
import SellerOnboardingForm from "@/components/store/SellerOnboardingForm"
import styles from "./sell.module.css"

export const metadata: Metadata = {
  title: "Откройте магазин автотоваров на LeWheel",
  description: "Свой интернет-магазин запчастей, масел, автохимии и аксессуаров на маркетплейсе LeWheel: витрина, загрузка прайса, заказы и заявки покупателей.",
  alternates: { canonical: "/sell" },
}

/* Только то, что площадка делает уже сейчас: обещания без кода за ними
   продавец проверит первым же заказом. */
const BENEFITS = [
  { icon: IconWorldWww, title: "Своя витрина со своим адресом", text: "Страница магазина с каталогом, реквизитами и условиями поставки — ссылку можно дать клиентам и в соцсети." },
  { icon: IconSearch, title: "Покупатели находят по артикулу", text: "Позиции попадают в общий подбор запчастей: поиск идёт по OEM-номеру, кроссам, марке и модели." },
  { icon: IconMessageCircle, title: "Заявки «не нашёл деталь»", text: "Покупатель описывает, что ищет, — вы отвечаете предложением с ценой и сроком. Контакты покупателя видны сразу." },
  { icon: IconBellRinging, title: "Заказы прилетают в Telegram", text: "Новый заказ приходит уведомлением в бот — не нужно держать кабинет открытым." },
  { icon: IconFileSpreadsheet, title: "Каталог одним прайсом", text: "CSV из учётной программы или таблица, вставленная текстом. Перед загрузкой видно, какие строки примутся." },
  { icon: IconTruckDelivery, title: "В наличии и под заказ", text: "Для каждой позиции — срок поставки и страна. Покупатель заранее знает, когда получит деталь." },
]

const STEPS = [
  { title: "Анкета", text: "Название, город, ИНН и телефон. Пара минут." },
  { title: "Каталог", text: "Загрузите прайс сразу — проверка не держит работу." },
  { title: "Публикация", text: "Отправьте магазин на проверку, когда каталог готов." },
  { title: "Продажи", text: "Витрина в поиске, заказы и заявки — в кабинет и Telegram." },
]

const DEPARTMENTS = ["Запчасти", "Масла и жидкости", "Автохимия", "Аксессуары", "Шины и диски", "Инструменты"]

const FAQ = [
  { q: "Сколько стоит?", a: "Сейчас открытие магазина и размещение каталога бесплатны. Если условия изменятся, предупредим заранее — до того, как они начнут действовать." },
  { q: "Кто может открыть магазин?", a: "ИП, юрлицо или самозанятый. Реквизиты сверяем по ФНС до публикации витрины: покупатель должен понимать, у кого покупает." },
  { q: "Сколько ждать проверки?", a: "Каталог можно наполнять, не дожидаясь проверки. Администратор получает уведомление о вашей анкете сразу; публикуем, когда реквизиты сверены и каталог отправлен на проверку." },
  { q: "Какой формат прайса?", a: "CSV с колонками «название», «цена» и, по желанию, артикул, бренд, марка, модель, срок. Подсказки по колонкам — в кабинете продавца. Файлы из 1С в кодировке Windows-1251 читаются." },
  { q: "Как получать деньги?", a: "Оплату и доставку вы согласуете с покупателем напрямую: заказ приходит с его контактами. Онлайн-оплата через площадку появится позже." },
]

export default function SellPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="sell-title">
        <div>
          <span className={styles.eyebrow}>Маркетплейс автотоваров</span>
          <h1 id="sell-title" className={styles.title}>Ваш магазин автотоваров на LeWheel</h1>
          <p className={styles.lead}>
            Запчасти, масла, автохимия и аксессуары — своя витрина внутри площадки, где люди уже
            ищут машины, топливо и детали. Анкета, прайс — и вы в каталоге.
          </p>
          <div className={styles.heroActions}>
            <a href="#form" className={styles.primary}><IconBuildingStore size={18} /> Открыть магазин</a>
            <a href="/parts-finder" className={styles.secondary}>Посмотреть каталог</a>
          </div>
        </div>
        <div className={styles.flow} aria-hidden="true">
          <div className={styles.flowStep}>
            <span className={styles.flowIcon}><IconFileSpreadsheet size={20} /></span>
            <span><span className={styles.flowTitle}>price.csv</span><br /><span className={styles.code}>название; цена; артикул; бренд</span></span>
          </div>
          <div className={styles.flowStep}>
            <span className={styles.flowIcon}><IconShieldCheck size={20} /></span>
            <span><span className={styles.flowTitle}>Проверка строк</span><br /><span className={styles.flowText}>Видно, что примется и что нет — до загрузки</span></span>
          </div>
          <div className={styles.flowStep}>
            <span className={styles.flowIcon}><IconWorldWww size={20} /></span>
            <span><span className={styles.flowTitle}>lewheel.ru/store/ваш-магазин</span><br /><span className={styles.flowText}>Витрина и позиции в общем поиске</span></span>
          </div>
          <div className={styles.flowStep}>
            <span className={styles.flowIcon}><IconBellRinging size={20} /></span>
            <span><span className={styles.flowTitle}>Новый заказ</span><br /><span className={styles.flowText}>Уведомление в Telegram и в кабинет</span></span>
          </div>
        </div>
      </section>

      <section aria-labelledby="sell-benefits">
        <div className={styles.sectionHead}>
          <h2 id="sell-benefits" className={styles.h2}>Что получает магазин</h2>
          <p className={styles.muted}>Инструменты, которые уже работают — без интеграторов и своего сайта.</p>
        </div>
        <div className={styles.benefits}>
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <div key={title} className={styles.benefit}>
              <span className={styles.benefitIcon}><Icon size={22} /></span>
              <div>
                <h3 className={styles.benefitTitle}>{title}</h3>
                <p className={styles.benefitText}>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="sell-steps">
        <div className={styles.sectionHead}>
          <h2 id="sell-steps" className={styles.h2}>Как начать</h2>
        </div>
        <ol className={styles.steps}>
          {STEPS.map((step) => (
            <li key={step.title} className={styles.step}>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="form" className={styles.formWrap} aria-labelledby="sell-form">
        <div className={styles.sectionHead}>
          <h2 id="sell-form" className={styles.h2}>Анкета продавца</h2>
          <p className={styles.muted}>
            После отправки откроется кабинет магазина — можно сразу загружать прайс.
          </p>
          <div className={styles.departments}>
            {DEPARTMENTS.map((item) => <span key={item} className={styles.department}>{item}</span>)}
          </div>
        </div>
        <div className={styles.formCard}>
          <SellerOnboardingForm />
        </div>
      </section>

      <section aria-labelledby="sell-faq">
        <div className={styles.sectionHead}>
          <h2 id="sell-faq" className={styles.h2}>Вопросы продавцов</h2>
        </div>
        <div className={styles.faq}>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  )
}
