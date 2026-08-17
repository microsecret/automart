import { buildSeoMetadata } from "@/lib/seo-metadata"
export const metadata = buildSeoMetadata({ title: "Документы для покупки и продажи транспорта", description: "Чек-листы и документы для сделки с автомобилем, мотоциклом и другим транспортом без пропущенных этапов.", canonical: "/services/legal-documents", keywords: ["документы на автомобиль", "договор купли продажи", "документы для сделки"] })
export default function Layout({ children }: { children: React.ReactNode }) { return children }
