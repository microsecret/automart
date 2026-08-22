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
 * Нейтральный шильдик производителя для форм, карточек и каталогов.
 * Цвет используется только для знака — яркие заливки не подменяют логотип.
 */
export default function BrandIcon({ brand, size = 36, variant = "rounded" }: BrandIconProps) {
  const markColor = getBrandColor(brand)
  const radius = variant === "circle" ? "50%" : variant === "square" ? "6px" : "10px"
  const monogram = brand
    .trim()
    .split(/[\s/-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "•"
  const fontSize = Math.max(9, Math.round(size * (monogram.length > 1 ? 0.32 : 0.44)))
  const hasSvg = hasBrandLogo(brand)

  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        border: "1px solid rgba(20, 48, 107, 0.12)",
        /* Подложка светлая в обеих темах.

           Фирменные цвета марок рассчитаны на светлый фон и у многих почти
           чёрные: Kia #05141F, Mazda #101010, Lexus #1B1B1B. На тёмной
           поверхности они сливаются с ней — проверка контраста в тёмной
           теме показала 35 нечитаемых значков из 37 найденных проблем.

           Так же поступают автоплощадки: плашка марки всегда светлая, это
           её опознавательный признак. */
        background: "#f7f8fb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "var(--market-shadow-soft)",
      }}
      role="img"
      aria-label={`Марка ${brand}`}
    >
      {hasSvg ? (
        <BrandLogo brand={brand} size={Math.round(size * 0.62)} color={markColor} />
      ) : (
        <Text fw={800} fz={fontSize} c={markColor} lh={1} style={{ fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.04em" }}>
          {monogram}
        </Text>
      )}
    </Box>
  )
}
