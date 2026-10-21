"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Portal } from "@mantine/core"
import { IconArrowRight, IconHelpCircle, IconX } from "@tabler/icons-react"

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
  { selector: ".sidebar-create-cta, .mobile-bottom-nav__accent", title: "Продать — бесплатно", text: "Заполните объявление и отправьте на модерацию. После одобрения оно появится в каталоге." },
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
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (readSeen()) return
    /* Пауза, чтобы человек сначала увидел страницу, а не подсказку поверх
       недогруженной выдачи.

       Отметка «видел» ставится в момент показа, а не только по «Закрыть».
       Иначе каждое обновление страницы запускало тур заново — владелец
       поймал это на живом сайте 24.09.2026. */
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible" || document.activeElement?.matches("input, textarea, select, [contenteditable=true]")) return
      markSeen()
      setStep(0)
    }, 1800)
    const cancel = () => window.clearTimeout(timer)
    // First interaction means the visitor has already started a task. Leave
    // the optional replay control available instead of interrupting them.
    window.addEventListener("pointerdown", cancel, { once: true })
    window.addEventListener("keydown", cancel, { once: true })
    window.addEventListener("wheel", cancel, { once: true, passive: true })
    window.addEventListener("touchstart", cancel, { once: true, passive: true })
    return () => {
      cancel()
      window.removeEventListener("pointerdown", cancel)
      window.removeEventListener("keydown", cancel)
      window.removeEventListener("wheel", cancel)
      window.removeEventListener("touchstart", cancel)
    }
  }, [])

  const close = useCallback(() => {
    markSeen()
    if (panel.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true })
    setStep(null)
  }, [])

  function start() {
    markSeen()
    setStep(0)
    window.requestAnimationFrame(() => closeButton.current?.focus({ preventScroll: true }))
  }

  function next() {
    if (step === null) return
    for (let candidate = step + 1; candidate < STEPS.length; candidate++) {
      if (visibleTarget(STEPS[candidate].selector)) { setStep(candidate); return }
    }
    close()
  }

  useEffect(() => {
    if (step === null) return
    const target = visibleTarget(STEPS[step].selector)
    if (!target) return
    target.classList.add("lw-tour-target")
    /* Прокрутка — только если место за краем экрана. Раньше тур центрировал
       каждую цель, и на первом шаге страница сама съезжала вниз, обрезая
       заголовок героя. */
    const rect = target.getBoundingClientRect()
    const header = document.querySelector<HTMLElement>(".market-app-header")?.offsetHeight ?? 0
    const offscreen = rect.top < header || rect.bottom > window.innerHeight - 24
    if (offscreen) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" })
    }
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

  const current = step === null ? null : STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <>
    <button ref={trigger} type="button" className="lw-tour-launch" onClick={start} aria-expanded={step !== null} aria-controls={step === null ? undefined : id}>
      <IconHelpCircle size={16} aria-hidden="true" /> Как пользоваться каталогом
    </button>
    {current && step !== null && <Portal><div ref={panel} id={id} className="lw-tour" role="region" aria-label="Подсказки по каталогу">
      <button ref={closeButton} type="button" className="lw-tour__close" onClick={close} aria-label="Закрыть подсказки">
        <IconX size={17} stroke={2} aria-hidden="true" />
      </button>
      <div aria-live="polite" aria-atomic="true">
      <span className="lw-tour__count">{step + 1} / {STEPS.length}</span>
      <p className="lw-tour__title">{current.title}</p>
      <p className="lw-tour__text">{current.text}</p>
      </div>
      <div className="lw-tour__footer">
        <div className="lw-tour__dots" aria-hidden="true">
          {STEPS.map((item, index) => <span key={item.title} data-on={index === step || undefined} />)}
        </div>
        <button type="button" className="lw-tour__skip" onClick={close}>Пропустить</button>
        <button type="button" className="lw-tour__next" onClick={next}>
          {last ? "Понятно" : "Далее"}
          {!last && <IconArrowRight size={14} stroke={2.2} aria-hidden="true" />}
        </button>
      </div>
    </div></Portal>}
    </>
  )
}
