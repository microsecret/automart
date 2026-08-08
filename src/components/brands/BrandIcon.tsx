"use client"
import { Box, Text } from "@mantine/core"
import BrandLogo, { hasBrandLogo } from "./BrandLogo"
import { getBrandColor, getContrastText } from "@/lib/brand-colors"

interface BrandIconProps {
  brand: string
  size?: number
  variant?: "square" | "circle" | "rounded"
}

/**
 * Компактный цветной значок бренда.
 * Фон = фирменный цвет, контент = SVG-логотип или первая буква.
 */
export default function BrandIcon({ brand, size = 36, variant = "rounded" }: BrandIconProps) {
  const bg = getBrandColor(brand)
  const fg = getContrastText(bg)
  const radius = variant === "circle" ? "50%" : variant === "square" ? "6px" : "10px"
  const letter = brand.charAt(0).toUpperCase()
  const fontSize = Math.round(size * 0.45)
  const hasSvg = hasBrandLogo(brand)

  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
      }}
    >
      {hasSvg ? (
        <BrandLogo brand={brand} size={Math.round(size * 0.58)} color={fg} />
      ) : (
        <Text fw={800} fz={fontSize} c={fg} lh={1} style={{ fontFamily: "var(--font-display), sans-serif" }}>
          {letter}
        </Text>
      )}
    </Box>
  )
}
