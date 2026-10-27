"use client"

import ProductGroupArtwork from "./ProductGroupArtwork"
import { Box, Group, Text, UnstyledButton } from "@mantine/core"
import { IconTool } from "@tabler/icons-react"
import { DEPARTMENTS, productGroupsOfDepartment, type DepartmentKey } from "@/lib/product-groups"


/**
 * Отделы магазина и товарные группы — как плитки «Аккумуляторы»,
 * «Масла», «Шины» у автомагазинов. Выбор группы открывает фильтры по её
 * характеристикам.
 */
export default function DepartmentNav({ group, department, onSelect }: {
  group: string | null
  department: DepartmentKey | null
  onSelect: (next: { department: DepartmentKey | null; group: string | null }) => void
}) {
  const current = department ?? DEPARTMENTS[0].key
  const groups = productGroupsOfDepartment(current)

  return (
    <Box className="parts-departments">
      <Group gap={6} wrap="nowrap" className="parts-departments__tabs" role="tablist" aria-label="Отделы">
        {DEPARTMENTS.map((item) => (
          <UnstyledButton
            key={item.key}
            role="tab"
            aria-selected={item.key === current}
            className="parts-departments__tab"
            data-active={item.key === current || undefined}
            onClick={() => onSelect({ department: item.key, group: null })}
          >
            {item.label}
          </UnstyledButton>
        ))}
      </Group>
      <div className="parts-departments__groups">
        {groups.map((item) => {
          const isOn = group === item.key
          return (
            <UnstyledButton
              key={item.key}
              className="parts-departments__group"
              data-product-group={item.key}
              data-active={isOn || undefined}
              aria-pressed={isOn}
              onClick={() => onSelect({ department: current, group: isOn ? null : item.key })}
            >
              <span className="parts-departments__icon"><ProductGroupArtwork group={item.key} fallback={<IconTool size={22} stroke={1.6} />} /></span>
              <Text span size="sm" fw={700} lh={1.25}>{item.label}</Text>
            </UnstyledButton>
          )
        })}
      </div>
    </Box>
  )
}
