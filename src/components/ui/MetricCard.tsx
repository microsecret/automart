import type { ReactNode } from "react"
import Link from "next/link"
import { Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core"

type MetricCardProps = {
  label: string
  value: string | number
  icon?: ReactNode
  color?: string
  description?: string
  href?: string
  className?: string
  size?: "sm" | "md"
}

/** Одна геометрия числовых показателей для кабинета, оплат и сделок. */
export default function MetricCard({
  label,
  value,
  icon,
  color = "indigo",
  description,
  href,
  className,
  size = "sm",
}: MetricCardProps) {
  const content = (
    <Group gap="sm" align="center" wrap="nowrap">
      {icon && (
        <ThemeIcon variant="light" color={color} size={size === "md" ? 40 : 36} radius="md" aria-hidden="true">
          {icon}
        </ThemeIcon>
      )}
      <Stack gap={1} miw={0}>
        <Text
          fw={800}
          fz={size === "md" ? "xl" : "lg"}
          lh={1.1}
          c="var(--market-ink)"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={2}>{description || label}</Text>
      </Stack>
    </Group>
  )

  const sharedProps = {
    radius: "md" as const,
    p: size === "md" ? "md" : "sm",
    withBorder: true,
    className,
  }

  if (href) {
    return (
      <Paper component={Link} href={href} aria-label={`${label}: ${String(value)}`} {...sharedProps}>
        {content}
      </Paper>
    )
  }

  return <Paper {...sharedProps}>{content}</Paper>
}
