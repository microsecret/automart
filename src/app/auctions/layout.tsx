import type { Metadata } from "next"

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

export default function AuctionsLayout({ children }: { children: React.ReactNode }) {
  return children
}
