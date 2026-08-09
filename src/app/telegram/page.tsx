import type { Metadata } from "next"
import TelegramMiniApp from "@/components/telegram/TelegramMiniApp"

export const metadata: Metadata = {
  title: "Авторынок в Telegram",
  description: "Mini App Авторынка для поиска транспорта, запчастей и управления объявлениями.",
}

export default function TelegramPage() {
  return <TelegramMiniApp />
}
