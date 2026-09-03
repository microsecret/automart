import { buildSeoMetadata } from "@/lib/seo-metadata"

/* Страница отзывов была невидима для поиска: без метаданных она получала
   заголовок из общего шаблона, без описания и без канонической ссылки.
   Отзывы — контент, который ищут по названию сети и по имени продавца,
   и терять его незачем. */
export const metadata = buildSeoMetadata({
  title: "Отзывы о продавцах и сделках",
  description: "Что пишут покупатели и продавцы о сделках на площадке: оценки, подробности осмотра и передачи техники.",
  canonical: "/reviews",
  keywords: ["отзывы о продавцах", "отзывы автосалон", "отзывы о сделках"],
})

export default function Layout({ children }: { children: React.ReactNode }) { return children }
