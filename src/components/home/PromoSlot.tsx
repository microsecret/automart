import Link from "next/link"
import { IconArrowRight, IconBuildingStore, IconShieldCheck, IconTool } from "@tabler/icons-react"

/**
 * Рекламные места на главной — ряд из трёх билбордов.
 *
 * Пока рекламодателей нет, показывать пустой прямоугольник с надписью
 * «здесь могла быть ваша реклама» — значит признаваться посетителю, что
 * площадку никто не покупает. Поэтому каждое место занято предложением
 * разместиться под конкретную аудиторию: это честное содержание, и оно
 * заменяется на настоящий баннер без перевёрстки.
 *
 * Одна широкая синяя плита сливалась с героем по цвету — владелец принял
 * её за часть витрины. Билборды подписаны «Реклама», стоят на светлой
 * подложке со своей рамкой и читаются отдельным слоем страницы.
 *
 * Серверный компонент: ни состояния, ни обработчиков — значит, и
 * скрипта в браузере он не добавляет.
 */
const BOARDS = [
  {
    tone: "blue",
    Icon: IconBuildingStore,
    title: "Автосалонам и дилерам",
    lede: "Витрина салона рядом с каталогом — перед теми, кто выбирает машину сегодня.",
  },
  {
    tone: "orange",
    Icon: IconTool,
    title: "Сервисам и шиномонтажу",
    lede: "Запись на ремонт и ТО для владельцев машин из вашего города.",
  },
  {
    tone: "teal",
    Icon: IconShieldCheck,
    title: "Страховым и банкам",
    lede: "ОСАГО, КАСКО и автокредит в момент, когда покупатель уже решился.",
  },
] as const

export default function PromoSlot() {
  return (
    <section className="promo-boards" aria-label="Рекламные места">
      <div className="promo-boards__head">
        <span className="promo-boards__label">Реклама</span>
        <span className="promo-boards__hint">Места на главной свободны</span>
      </div>
      <div className="promo-boards__grid">
        {BOARDS.map(({ tone, Icon, title, lede }) => (
          /* Ведём в поддержку: страницы с условиями размещения пока нет, и
             ссылка на неё была бы обещанием пустоты. Когда она появится,
             адрес меняется в одной строке. */
          <Link key={title} href="/help/support" prefetch={false} className="promo-board" data-tone={tone}>
            <span className="promo-board__icon" aria-hidden="true"><Icon size={20} stroke={1.8} /></span>
            <span className="promo-board__title">{title}</span>
            <span className="promo-board__lede">{lede}</span>
            <span className="promo-board__action">
              Условия размещения
              <IconArrowRight size={15} stroke={2} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
