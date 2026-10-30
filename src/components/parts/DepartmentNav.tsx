"use client"

import ProductGroupArtwork from "./ProductGroupArtwork"
import { useId } from "react"
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
  const id = useId()
  const panelId = `${id}-groups`

  return (
    <Box className="parts-departments">
      <Group gap={6} wrap="nowrap" className="parts-departments__tabs" role="tablist" aria-label="Отделы" aria-orientation="horizontal">
        {DEPARTMENTS.map((item, index) => (
          <UnstyledButton
            key={item.key}
            role="tab"
            id={`${id}-${item.key}`}
            aria-controls={panelId}
            aria-selected={item.key === current}
            tabIndex={item.key === current ? 0 : -1}
            className="parts-departments__tab"
            data-active={item.key === current || undefined}
            onClick={() => onSelect({ department: item.key, group: null })}
            onKeyDown={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey) return
              const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? DEPARTMENTS.length - 1
                : event.key === "ArrowRight" ? (index + 1) % DEPARTMENTS.length
                : event.key === "ArrowLeft" ? (index - 1 + DEPARTMENTS.length) % DEPARTMENTS.length : null
              if (nextIndex === null) return
              const rail = event.currentTarget.closest<HTMLElement>('[role="tablist"]')
              const target = rail?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]
              if (!rail || !target) return
              event.preventDefault()
              target.focus({ preventScroll: true })
              // Reveal only the horizontal rail; preserve the page's reading position.
              const bounds = rail.getBoundingClientRect(), itemBounds = target.getBoundingClientRect()
              const delta = itemBounds.left < bounds.left + 4 ? itemBounds.left - bounds.left - 4
                : itemBounds.right > bounds.right - 4 ? itemBounds.right - bounds.right + 4 : 0
              rail.scrollLeft += delta
              onSelect({ department: DEPARTMENTS[nextIndex].key, group: null })
            }}
          >
            {item.label}
          </UnstyledButton>
        ))}
      </Group>
      <div className="parts-departments__groups" role="tabpanel" id={panelId} aria-labelledby={`${id}-${current}`}>
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
