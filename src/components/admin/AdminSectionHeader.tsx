import type { ReactNode } from "react"
import { Group, Stack, Text, ThemeIcon } from "@mantine/core"

/**
 * Заголовок раздела админки: значок, название, пояснение.
 *
 * Дословно повторялся двадцать три раза — с теми же размерами значка и
 * тем же расположением. Повтор механический, поэтому и вынос безопасный:
 * ни одно из мест не отличалось ничем, кроме текста и цвета.
 */
export type AdminSectionHeaderProps = {
  icon: ReactNode
  title: string
  description?: ReactNode
  /** Цвет значка из палитры Mantine. */
  color?: string
  /** Действия справа: кнопки обновления, фильтры, ссылки. */
  right?: ReactNode
}

export function AdminSectionHeader({ icon, title, description, color = "indigo", right }: AdminSectionHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" color={color} size={36} radius="md">
          {icon}
        </ThemeIcon>
        <Stack gap={1} style={{ minWidth: 0 }}>
          <Text size="sm" fw={700} c="var(--market-ink)">{title}</Text>
          {description && <Text size="xs" c="dimmed">{description}</Text>}
        </Stack>
      </Group>
      {right}
    </Group>
  )
}
