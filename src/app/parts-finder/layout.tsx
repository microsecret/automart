import { buildSeoMetadata } from "@/lib/seo-metadata"

export const metadata = buildSeoMetadata({
  title: "Поиск автозапчастей по автомобилю и OEM-номеру",
  description: "Подберите новую или подержанную запчасть по марке, модели, году, категории и OEM-номеру в каталоге LeWheel.",
  canonical: "/parts-finder",
  keywords: ["поиск автозапчастей", "запчасти по VIN", "OEM номер", "запчасти по марке"],
})

export default function PartsFinderLayout({ children }: { children: React.ReactNode }) { return children }
