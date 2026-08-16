import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Марки транспорта",
  description: "Официальные логотипы и каталог марок легковых автомобилей, мотоциклов, грузовиков, спецтехники, водного и воздушного транспорта.",
  alternates: { canonical: "/brands" },
  openGraph: {
    type: "website",
    title: "Марки транспорта — LeWheel",
    description: "Каталог марок легковых автомобилей, мотоциклов, грузовиков, спецтехники, водного и воздушного транспорта.",
    url: "/brands",
  },
  twitter: { card: "summary_large_image", title: "Марки транспорта — LeWheel", description: "Каталог официальных марок транспорта на LeWheel." },
}

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return children
}
