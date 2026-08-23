import type { Metadata } from "next"
import Script from "next/script"
import TelegramMiniApp from "@/components/telegram/TelegramMiniApp"
import "./telegram.css"

export const metadata: Metadata = {
  title: "LeWheel в Telegram",
  description: "Приложение Авторынка: свежие объявления транспорта, аукционы и подача объявления прямо в Telegram.",
  /* Страница приложения из поиска не открывается: вне Telegram она
     показывает только предложение перейти на сайт. Пусть поисковик ведёт
     людей на витрину, а не сюда. */
  robots: { index: false, follow: true },
}

export default function TelegramPage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <TelegramMiniApp />
    </>
  )
}
