import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Автомобили с зарубежных площадок",
  description: "Актуальные автомобили из Кореи, Китая, Японии, США и Европы с фотографиями, характеристиками и предварительным расчётом доставки в Россию.",
  alternates: { canonical: "/auctions" },
  openGraph: {
    type: "website",
    title: "Автомобили с зарубежных площадок — LeWheel",
    description: "Актуальные лоты, фотографии, характеристики и предварительный расчёт доставки автомобиля в Россию.",
    url: "/auctions",
  },
  twitter: { card: "summary_large_image", title: "Автомобили с зарубежных площадок — LeWheel", description: "Актуальные лоты и предварительный расчёт доставки в Россию." },
}

export default function AuctionsLayout({ children }: { children: React.ReactNode }) {
  return children
}
