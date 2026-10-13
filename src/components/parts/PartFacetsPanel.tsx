"use client"

import { useEffect, useState } from "react"
import { Badge, Box, Button, Collapse, Group, Paper, Stack, Text, TextInput, UnstyledButton } from "@mantine/core"
import { IconChevronDown } from "@tabler/icons-react"

export type Facet =
  | { key: string; label: string; unit?: string; type: "chips"; values: Array<{ value: string; label: string; count: number }> }
  | { key: string; label: string; unit?: string; type: "range"; min: number; max: number }

/**
 * Фильтры по характеристикам товарной группы — колонка как у
 * автомагазинов: «Ёмкость, Ач», «Полярность», «Длина». Значения берутся
 * из текущей выдачи, поэтому пустых вариантов «0 товаров» здесь нет.
 *
 * Значение фильтра: «55|60» для кнопок и «50..70» для диапазона — в том
 * же виде оно лежит в адресе страницы и уходит в API.
 */
export default function PartFacetsPanel({
  title, facets, values, onChange, onReset, bare = false,
}: {
  title: string
  facets: Facet[]
  values: Record<string, string>
  onChange: (key: string, value: string | null) => void
  onReset: () => void
  /** Без своей рамки и заголовка — внутри колонки фильтров. */
  bare?: boolean
}) {
  const active = Object.values(values).filter(Boolean).length
  if (!facets.length) return null
  if (bare) {
    return (
      <Stack gap={0}>
        {facets.map((facet) => (
          <FacetSection key={facet.key} facet={facet} value={values[facet.key] || ""} onChange={(value) => onChange(facet.key, value)} />
        ))}
      </Stack>
    )
  }

  return (
    <Paper radius="md" p="sm" withBorder className="parts-facets">
      <Group justify="space-between" mb={6} wrap="nowrap">
        <Text fw={800} size="sm" c="var(--market-ink)">Характеристики · {title}</Text>
        {active > 0 && <Button variant="subtle" color="gray" size="compact-xs" onClick={onReset}>Сбросить {active}</Button>}
      </Group>
      <Stack gap={0}>
        {facets.map((facet) => (
          <FacetSection key={facet.key} facet={facet} value={values[facet.key] || ""} onChange={(value) => onChange(facet.key, value)} />
        ))}
      </Stack>
    </Paper>
  )
}

function FacetSection({ facet, value, onChange }: { facet: Facet; value: string; onChange: (value: string | null) => void }) {
  const [open, setOpen] = useState(true)
  const selected = value ? value.split("|") : []
  const heading = facet.unit && facet.type === "range" ? `${facet.label}, ${facet.unit}` : facet.label

  return (
    <Box className="parts-facets__section">
      <UnstyledButton className="parts-facets__head" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <Text size="sm" fw={700}>{heading}</Text>
        <Group gap={6} wrap="nowrap">
          {value && <Badge size="xs" variant="filled" color="indigo">{facet.type === "range" ? "задано" : selected.length}</Badge>}
          <IconChevronDown size={16} className="parts-facets__chevron" data-open={open || undefined} />
        </Group>
      </UnstyledButton>
      <Collapse in={open} transitionDuration={180}>
        {facet.type === "chips" ? (
          <Group gap={6} pb="sm" wrap="wrap">
            {facet.values.map((item) => {
              const isOn = selected.includes(item.value)
              return (
                <Button
                  key={item.value}
                  size="compact-sm"
                  radius="xl"
                  variant={isOn ? "filled" : "default"}
                  color="indigo"
                  aria-pressed={isOn}
                  onClick={() => {
                    const next = isOn ? selected.filter((entry) => entry !== item.value) : [...selected, item.value]
                    onChange(next.length ? next.join("|") : null)
                  }}
                >
                  {item.label}
                  <Text span size="xs" c={isOn ? "rgba(255,255,255,.75)" : "dimmed"} ml={6}>{item.count}</Text>
                </Button>
              )
            })}
          </Group>
        ) : (
          <RangeInputs facet={facet} value={value} onChange={onChange} />
        )}
      </Collapse>
    </Box>
  )
}

function RangeInputs({ facet, value, onChange }: { facet: Extract<Facet, { type: "range" }>; value: string; onChange: (value: string | null) => void }) {
  const [from, to] = value ? value.split("..") : ["", ""]
  const [draft, setDraft] = useState({ from: from || "", to: to || "" })
  useEffect(() => { setDraft({ from: from || "", to: to || "" }) }, [from, to])

  /* Применяется по уходу из поля и Enter: на каждую цифру запрос не
     уходит, иначе выдача мигает, пока набирается «600». */
  const apply = () => {
    const next = draft.from || draft.to ? `${draft.from}..${draft.to}` : null
    if (next !== (value || null)) onChange(next)
  }

  return (
    <Group gap={6} pb="sm" wrap="nowrap" grow>
      <TextInput
        size="xs" inputMode="decimal" aria-label={`${facet.label} от`} placeholder={`от ${facet.min}`}
        value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.currentTarget.value.replace(/[^\d.,-]/g, "") })}
        onBlur={apply} onKeyDown={(event) => { if (event.key === "Enter") apply() }}
      />
      <TextInput
        size="xs" inputMode="decimal" aria-label={`${facet.label} до`} placeholder={`до ${facet.max}`}
        value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.currentTarget.value.replace(/[^\d.,-]/g, "") })}
        onBlur={apply} onKeyDown={(event) => { if (event.key === "Enter") apply() }}
      />
    </Group>
  )
}
