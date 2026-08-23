import { redirect } from "next/navigation"

/**
 * Старые ссылки на быструю подачу остаются рабочими, но отдельная короткая
 * форма больше не создаёт неполные объявления.
 */
export default function QuickCreatePage() {
  redirect("/listings/create/vehicle")
}
