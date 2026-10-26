"use client"

import { useEffect, useRef, useState } from "react"
import { tapFeedback } from "@/lib/telegram-webapp"
import MiniArt from "./MiniArt"

/**
 * Короткое знакомство при первом запуске: три карточки и «Начать».
 *
 * Человек, впервые открывший приложение из бота, не знал, что здесь
 * есть аукционы и что объявление подаётся одной кнопкой внизу экрана, —
 * главная кнопка Telegram выглядит частью мессенджера, а не нашей.
 * Знакомство показывается один раз и пропускается одним касанием.
 */

const STORAGE_KEY = "lw-mini-onboarding-v1"

const SLIDES = [
  {
    art: "vehicles",
    title: "Свежие объявления каждый день",
    text: "Листайте ленту, выбирайте тип техники и ищите по марке или городу.",
  },
  {
    art: "auctions",
    title: "Аукционы Кореи, Японии и Китая",
    text: "Цена лота с комиссией сразу в рублях, расчёт под ключ — в карточке лота.",
  },
  {
    art: "publish",
    title: "Продайте машину за пару минут",
    text: "Кнопка «Разместить объявление» всегда внизу экрана. Размещение бесплатно.",
  },
] as const

export default function TelegramOnboarding() {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [step, setStep] = useState(0)
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // Хранилище закрыто — знакомство не показываем, иначе оно всплывало бы при каждом запуске.
    }
  }, [])

  useEffect(() => {
    if (visible) primaryRef.current?.focus({ preventScroll: true })
  }, [visible, step])

  if (!visible) return null

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "done")
    } catch {
      // Не запомнилось — покажется в следующий раз, это не поломка.
    }
    setClosing(true)
    window.setTimeout(() => setVisible(false), 260)
  }

  const next = () => {
    tapFeedback()
    if (step < SLIDES.length - 1) setStep(step + 1)
    else finish()
  }

  const slide = SLIDES[step]
  const last = step === SLIDES.length - 1

  return (
    <div className="tg-tour" data-closing={closing || undefined} role="dialog" aria-modal="true" aria-labelledby="tg-tour-title">
      <div className="tg-tour__backdrop" onClick={finish} aria-hidden="true" />
      <div className="tg-tour__card">
        <button type="button" className="tg-tour__skip" onClick={finish}>Пропустить</button>
        {/* Ключ по шагу перезапускает въезд значка и текста. */}
        <div className="tg-tour__slide" key={step}>
          <span className="tg-tour__art"><MiniArt kind={slide.art} size={112} /></span>
          <h2 id="tg-tour-title" className="tg-tour__title">{slide.title}</h2>
          <p className="tg-tour__text">{slide.text}</p>
        </div>
        <div className="tg-tour__dots" aria-hidden="true">
          {SLIDES.map((item, index) => (
            <span key={item.art} className="tg-tour__dot" data-active={index === step || undefined} />
          ))}
        </div>
        <button ref={primaryRef} type="button" className="tg-tour__next" onClick={next}>
          {last ? "Начать" : "Дальше"}
        </button>
        <span className="tg-tour__step" aria-live="polite">Шаг {step + 1} из {SLIDES.length}</span>
      </div>
    </div>
  )
}
