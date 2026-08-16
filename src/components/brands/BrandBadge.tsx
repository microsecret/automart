"use client"

import { Badge } from "@mantine/core"
import { getBrandColor, getContrastText } from "@/lib/brand-colors"

interface BrandBadgeProps {
  brand: string
  size?: "xs" | "sm" | "md"
  variant?: "solid" | "outline"
}

export default function BrandBadge({ brand, size = "sm", variant = "solid" }: BrandBadgeProps) {
  const bg = getBrandColor(brand)
  const fg = getContrastText(bg)

  if (variant === "outline") {
    return (
      <Badge
        size={size}
        radius="sm"
        variant="light"
        color="gray"
        style={{ color: bg, borderColor: bg, fontWeight: 600 }}
      >
        {brand}
      </Badge>
    )
  }

  return (
    <Badge
      size={size}
      radius="sm"
      style={{
        background: bg,
        color: fg,
        fontWeight: 600,
        textTransform: "none",
        letterSpacing: "0",
      }}
    >
      {brand}
    </Badge>
  )
}
