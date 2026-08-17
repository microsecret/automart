import { buildSeoMetadata } from "@/lib/seo-metadata"
export const metadata = buildSeoMetadata({ title: "Умный подбор автомобиля по параметрам", description: "Подберите автомобиль по бюджету, назначению и характеристикам среди объявлений и зарубежных площадок LeWheel.", canonical: "/services/smart-matching", keywords: ["подбор автомобиля", "найти авто по бюджету", "авто из Кореи", "авто из Китая"] })
export default function Layout({ children }: { children: React.ReactNode }) { return children }
