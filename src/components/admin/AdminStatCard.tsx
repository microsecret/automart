import type { ReactNode } from "react"
import { Card, Group, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

/**
 * Карточка «крупное число и подпись» в админке.
 *
 * Один и тот же визуал был написан заново в семи местах четырьмя
 * несовместимыми способами: числа набирались то `fz="xl"`, то `fz={28}`,
 * то `fz={26}`, и одинаковые по смыслу показатели выглядели по-разному на
 * соседних страницах. Три блока при этом раскрывались вручную вместо
 * перебора — по сорок строк почти одинакового разметочного кода.
 */
export type AdminStatCardProps = {
  /** Показатель. Строка допустима: «—» на время загрузки. */
  value: ReactNode
  label: string
  /** Уточнение под подписью: период, источник, пояснение. */
  hint?: ReactNode
  icon?: ReactNode
  /** Цвет значка из палитры Mantine. */
  color?: string
  /**
   * Изменение к прошлому периоду в процентах. Знак определяет и цвет, и
   * направление стрелки — сотруднику важно увидеть падение мгновенно.
   */
  changePercent?: number | null
  changeLabel?: string
}

export function AdminStatCard({
  value,
  label,
  hint,
  icon,
  color = "indigo",
  changePercent,
  changeLabel = "к прошлому периоду",
}: AdminStatCardProps) {
  return (
    <Card withBorder radius="md" p="md">
      <Group gap="sm" align="flex-start" wrap="nowrap">
        {icon && (
          <ThemeIcon variant="light" color={color} size={36} radius="md">
            {icon}
          </ThemeIcon>
        )}
        <Stack gap={2} style={{ minWidth: 0 }}>
          {/* Моноширинные цифры: без них соседние карточки в ряду прыгают
              по ширине при обновлении данных. */}
          <Text
            fz={26}
            fw={800}
            lh={1}
            ff="var(--font-display),sans-serif"
            c="var(--market-ink)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {value}
          </Text>
          <Text size="sm" fw={600} c="var(--market-ink)">{label}</Text>
          {hint && <Text size="xs" c="dimmed">{hint}</Text>}

          {typeof changePercent === "number" && (
            <Group gap={4} mt={2} wrap="nowrap">
              <ThemeIcon variant="light" size={20} radius="sm" color={changePercent >= 0 ? "teal" : "red"}>
                {changePercent >= 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
              </ThemeIcon>
              <Text size="xs" c={changePercent >= 0 ? "teal.7" : "red.7"} fw={600}>
                {changePercent >= 0 ? "+" : ""}{changePercent}% {changeLabel}
              </Text>
            </Group>
          )}
        </Stack>
      </Group>
    </Card>
  )
}
