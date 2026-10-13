"use client"

import { Button, Group, Select, SimpleGrid, Text, TextInput } from "@mantine/core"
import { IconWand } from "@tabler/icons-react"
import { DEPARTMENTS, PRODUCT_GROUP_BY_KEY, PRODUCT_GROUPS, readProductAttributes } from "@/lib/product-groups"

/* Выбор группы, сгруппированный по отделам: «Масла и жидкости →
   Моторные масла». */
const GROUP_OPTIONS = DEPARTMENTS.map((department) => ({
  group: department.label,
  items: PRODUCT_GROUPS.filter((item) => item.department === department.key).map((item) => ({ value: item.key, label: item.label })),
})).filter((section) => section.items.length)

/** Значения характеристик в форме — строки, как их набирает человек. */
export function attributesToForm(values: Array<{ key: string; num: number | null; text: string | null }> | undefined) {
  return Object.fromEntries((values || []).map((value) => [value.key, value.num !== null ? String(value.num) : value.text ?? ""]))
}

/**
 * Поля характеристик для выбранной товарной группы.
 *
 * Перечисления — списком (полярность, сезон), числа — с единицей в
 * подписи, остальное — строкой. «Заполнить из названия» достаёт то, что
 * уже написано в названии позиции, — продавцу остаётся проверить.
 */
export default function ProductAttributesFields({ name, group, values, onGroupChange, onValuesChange }: {
  name: string
  group: string | null
  values: Record<string, string>
  onGroupChange: (group: string | null) => void
  onValuesChange: (values: Record<string, string>) => void
}) {
  const current = group ? PRODUCT_GROUP_BY_KEY.get(group) ?? null : null

  const fillFromName = () => {
    if (!current) return
    const extracted = readProductAttributes(current, name)
    const next = { ...values }
    for (const value of extracted) {
      if (!next[value.key]) next[value.key] = value.num !== null ? String(value.num) : value.text ?? ""
    }
    onValuesChange(next)
  }

  return (
    <>
      <Select
        label="Товарная группа"
        description="От неё зависят характеристики и фильтры в каталоге"
        placeholder="Не выбрана"
        data={GROUP_OPTIONS}
        value={group}
        onChange={(value) => { onGroupChange(value); onValuesChange({}) }}
        searchable
        clearable
      />
      {current && current.attributes.length > 0 && (
        <>
          <Group justify="space-between" align="center" mt={4}>
            <Text size="sm" fw={700}>Характеристики</Text>
            <Button variant="subtle" size="compact-xs" leftSection={<IconWand size={14} />} onClick={fillFromName} disabled={!name.trim()}>
              Заполнить из названия
            </Button>
          </Group>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            {current.attributes.map((def) => {
              const label = def.unit && def.kind === "number" ? `${def.label}, ${def.unit}` : def.label
              const value = values[def.key] ?? ""
              const set = (next: string | null) => onValuesChange({ ...values, [def.key]: next ?? "" })
              if (def.kind === "enum" && def.options) {
                return (
                  <Select
                    key={def.key} label={label} placeholder="—" clearable
                    data={def.options.map((option) => option.value)}
                    value={value || null} onChange={set}
                  />
                )
              }
              return (
                <TextInput
                  key={def.key} label={label}
                  inputMode={def.kind === "number" ? "decimal" : undefined}
                  placeholder={def.kind === "number" && def.min !== undefined ? `${def.min}–${def.max}` : undefined}
                  value={value}
                  onChange={(event) => set(def.kind === "number" ? event.currentTarget.value.replace(/[^\d.,-]/g, "") : event.currentTarget.value)}
                />
              )
            })}
          </SimpleGrid>
        </>
      )}
    </>
  )
}
