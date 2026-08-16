import type { Metadata } from "next"
import Script from "next/script"
import TelegramMiniApp from "@/components/telegram/TelegramMiniApp"

export const metadata: Metadata = {
  title: "LeWheel в Telegram",
  description: "Mini App Авторынка для поиска транспорта, запчастей и управления объявлениями.",
}

export default function TelegramPage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <TelegramMiniApp />
    </>
  )
}
