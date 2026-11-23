"use client"

import { useEffect, useRef } from "react"

const visibilityThreshold = 0.65
const arrivalDelay = 360
const restDelay = 500
const shineDuration = 680
const mechanicalDuration = 1600

export default function PartMotionController() {
  const marker = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const scope = marker.current?.parentElement
    if (!scope || typeof IntersectionObserver === "undefined") return

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const icons = Array.from(scope.querySelectorAll<HTMLElement>("[data-part-motion]"))
    const visible = new Set<HTMLElement>()
    const played = new Set<HTMLElement>()
    const sheets = new Map<string, Promise<HTMLImageElement | null>>()
    let active: HTMLElement | undefined
    let overlay: HTMLElement | undefined
    let timer: number | undefined
    let sequence = 0

    function cancel() {
      sequence++
      window.clearTimeout(timer)
      timer = undefined
      if (active) delete active.dataset.partPlaying
      active = undefined
      overlay?.remove()
      overlay = undefined
    }

    function loadSheet(kind: string) {
      if (kind !== "belt" && kind !== "chain") return Promise.resolve(null)
      const cached = sheets.get(kind)
      if (cached) return cached
      const image = new Image()
      image.alt = ""
      image.draggable = false
      image.src = `/images/ui/part-motion-v1/${kind}.webp`
      const ready = image.decode().then(() => image, () => null)
      sheets.set(kind, ready)
      return ready
    }

    function enabled() {
      return !preference.matches && document.visibilityState === "visible"
    }

    function pending() {
      return icons.filter((icon) => visible.has(icon) && !played.has(icon))
    }

    function schedule(delay = arrivalDelay) {
      if (timer !== undefined || active || !enabled() || pending().length === 0) return
      timer = window.setTimeout(() => {
        timer = undefined
        void next()
      }, delay)
    }

    async function next() {
      if (!enabled()) return
      const candidates = pending()
      const card = candidates.find((icon) => icon.dataset.partMotion === "turbine")
        ?? candidates.find((icon) => icon.dataset.partMotion !== "shine")
        ?? candidates[0]
      const kind = card?.dataset.partMotion
      const still = card?.querySelector("img")
      if (!card || !kind || !still) return

      played.add(card)
      active = card
      const attempt = ++sequence
      const [image, loaded] = await Promise.all([
        loadSheet(kind),
        still.decode().then(() => true, () => false),
      ])
      if (attempt !== sequence || !enabled() || !visible.has(card)) return
      if (!loaded) {
        cancel()
        schedule()
        return
      }

      if (image) {
        overlay = document.createElement("span")
        overlay.className = "part-category__nav-frames"
        overlay.append(image)
        card.append(overlay)
      }
      const mode = image ? "frames" : kind === "crank" ? "crank" : "shine"
      card.dataset.partPlaying = mode
      timer = window.setTimeout(() => {
        cancel()
        schedule(restDelay)
      }, mode === "shine" ? shineDuration : mechanicalDuration)
    }

    function availabilityChanged() {
      if (!enabled()) {
        if (active) played.delete(active)
        cancel()
      } else schedule()
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const icon = entry.target as HTMLElement
        if (entry.intersectionRatio >= visibilityThreshold) visible.add(icon)
        else {
          visible.delete(icon)
          played.delete(icon)
          if (active === icon) cancel()
        }
      }
      if (visible.size === 0) cancel()
      schedule()
    }, { threshold: visibilityThreshold })

    icons.forEach((icon) => observer.observe(icon))
    document.addEventListener("visibilitychange", availabilityChanged)
    preference.addEventListener("change", availabilityChanged)
    return () => {
      observer.disconnect()
      observer.takeRecords()
      document.removeEventListener("visibilitychange", availabilityChanged)
      preference.removeEventListener("change", availabilityChanged)
      cancel()
    }
  }, [])

  return <span ref={marker} hidden />
}
