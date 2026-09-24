"use client"

import { useCallback, useEffect, useState } from "react"
import { IconArrowRight, IconX } from "@tabler/icons-react"

/**
 * Короткий тур по главной — четыре шага при первом визите.
 *
 * Площадка умеет больше, чем видно с первого экрана: поиск по марке,
 * готовые подборки, аукционы и бесплатная подача. Новичок узнавал об этом
 * случайно. Тур подсвечивает каждое место кольцом и одной фразой говорит,
 * зачем оно; четыре шага, не больше, и закрыть можно в любой момент.
 *
 * Показывается один раз: отметка в localStorage. Не мешает тем, кто уже
 * бывал, и не появляется, если хранилище недоступно (приватное окно) —
 * лучше не показать, чем показывать при каждом заходе.
 */
const STEPS = [
  { selector: ".home-hero__search", title: "Ищите по марке", text: "Наберите марку или модель — выдача ниже сузится сразу, без перезагрузки." },
  { selector: ".home-quick", title: "Пять быстрых путей", text: "Купить, продать, аукционы Азии и Европы, запчасти и цены на заправках." },
  { selector: ".catalog-presets", title: "Готовые подборки", text: "«До миллиона», «Автомат» — частые запросы одним нажатием. Нажмите ещё раз, чтобы снять." },
  { selector: ".sidebar-create-cta, .mobile-bottom-nav__accent", title: "Продать — бесплатно", text: "Объявление публикуется за пару минут и уходит в каталог и Telegram." },
] as const

const STORAGE_KEY = "lw-quick-tour-v1"

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "done"
  } catch {
    return true
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "done")
  } catch {
    /* хранилище недоступно — тур просто не запомнится */
  }
}

function visibleTarget(selector: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return nodes.find((node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden") || null
}

export default function QuickTour() {
  const [step, setStep] = useState<number | null>(null)

  useEffect(() => {
    if (readSeen()) return
    /* Пауза, чтобы человек сначала увидел страницу, а не подсказку поверх
       недогруженной выдачи. */
    const timer = window.setTimeout(() => setStep(0), 1800)
    return () => window.clearTimeout(timer)
  }, [])

  const close = useCallback(() => {
    markSeen()
    setStep(null)
  }, [])

  useEffect(() => {
    if (step === null) return
    const target = visibleTarget(STEPS[step].selector)
    if (!target) return
    target.classList.add("lw-tour-target")
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" })
    return () => target.classList.remove("lw-tour-target")
  }, [step])

  useEffect(() => {
    if (step === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step, close])

  if (step === null) return null
  const current = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <div className="lw-tour" role="dialog" aria-live="polite" aria-label={`Подсказка ${step + 1} из ${STEPS.length}`}>
      <button type="button" className="lw-tour__close" onClick={close} aria-label="Закрыть подсказки">
        <IconX size={15} stroke={2} />
      </button>
      <span className="lw-tour__count">{step + 1} / {STEPS.length}</span>
      <p className="lw-tour__title">{current.title}</p>
      <p className="lw-tour__text">{current.text}</p>
      <div className="lw-tour__footer">
        <div className="lw-tour__dots" aria-hidden="true">
          {STEPS.map((item, index) => <span key={item.title} data-on={index === step || undefined} />)}
        </div>
        <button type="button" className="lw-tour__skip" onClick={close}>Пропустить</button>
        <button type="button" className="lw-tour__next" onClick={() => (last ? close() : setStep(step + 1))}>
          {last ? "Понятно" : "Далее"}
          {!last && <IconArrowRight size={14} stroke={2.2} />}
        </button>
      </div>
    </div>
  )
}
