"use client"
import { Box, Text } from "@mantine/core"
import BrandLogo, { hasBrandLogo } from "./BrandLogo"
import { getBrandColor } from "@/lib/brand-colors"

interface BrandIconProps {
  brand: string
  size?: number
  variant?: "square" | "circle" | "rounded"
}

/**
 * Знак марки: логотип, если он есть, иначе — начертание названия.
 *
 * Раньше здесь всегда рисовалась плашка со скруглением, а внутри — либо
 * логотип, либо одна-две буквы: «М» для Москвича, «У» для УАЗа, «А» для
 * Acura. Рядом при этом стояло полное название марки, то есть буква
 * ничего не добавляла — только повторяла первый знак и придавала списку
 * вид детских кубиков.
 *
 * Логотипы отрисованы у пятидесяти марок из ста шестидесяти шести.
 * Отраслевые каталоги в такой ситуации не выдумывают знак, а набирают
 * название: короткое начертание читается как шильдик и не притворяется
 * логотипом.
 *
 * Плашка остаётся только под логотипом — ему нужна светлая подложка,
 * потому что фирменные цвета рассчитаны на светлый фон и на тёмной теме
 * сливаются с ней.
 */
export default function BrandIcon({ brand, size = 36, variant = "rounded" }: BrandIconProps) {
  const markColor = getBrandColor(brand)
  const radius = variant === "circle" ? "50%" : variant === "square" ? "6px" : "10px"
  const hasSvg = hasBrandLogo(brand)

  if (hasSvg) {
    return (
      <Box
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          border: "1px solid rgba(20, 48, 107, 0.1)",
          /* Подложка светлая в обеих темах: фирменные цвета марок
             рассчитаны на светлый фон и у многих почти чёрные — Kia
             #05141F, Mazda #101010, Lexus #1B1B1B. На тёмной поверхности
             они сливаются с ней. */
          background: "#f7f8fb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
        role="img"
        aria-label={`Марка ${brand}`}
      >
        <BrandLogo brand={brand} size={Math.round(size * 0.66)} color={markColor} />
      </Box>
    )
  }

  /* Марка без отрисованного логотипа — набирается названием.

     Длинные названия сокращаются до первого слова: «Great Wall» → «Great»,
     «Land Rover» → «Land». Полное название и так стоит рядом, здесь нужен
     опознавательный знак, а не повтор. */
  const wordmark = brand.trim().split(/[\s/-]+/).filter(Boolean)[0] || brand
  const shortMark = wordmark.length > 7 ? `${wordmark.slice(0, 6)}·` : wordmark
  /* Кегль подбирается под длину: короткое «BMW» держит крупный знак,
     длинное «Chevrolet» ужимается, чтобы уместиться в ту же ширину. */
  const fontSize = Math.max(8, Math.round((size * 1.5) / Math.max(3, shortMark.length)))

  return (
    <Box
      style={{
        minWidth: size,
        height: size,
        paddingInline: Math.round(size * 0.14),
        borderRadius: radius,
        border: `1px solid ${markColor}22`,
        background: `${markColor}0f`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      role="img"
      aria-label={`Марка ${brand}`}
    >
      <Text
        fw={800}
        fz={fontSize}
        c={markColor}
        lh={1}
        style={{
          fontFamily: "var(--font-display), sans-serif",
          letterSpacing: "var(--track-title)",
          whiteSpace: "nowrap",
        }}
      >
        {shortMark}
      </Text>
    </Box>
  )
}
