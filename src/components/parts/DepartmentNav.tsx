"use client"

import ProductGroupArtwork from "./ProductGroupArtwork"
import { useId } from "react"
import { Box, Group, UnstyledButton } from "@mantine/core"
import { IconArrowRight, IconCheck, IconTool } from "@tabler/icons-react"
import { DEPARTMENTS, productGroupsOfDepartment, type DepartmentKey } from "@/lib/product-groups"

const DESCRIPTIONS: Readonly<Record<string, string>> = {
  battery: "Ёмкость, полярность и пусковой ток",
  brake_pads: "Для передней и задней оси",
  brake_discs: "Диаметр и тип диска",
  oil_filter: "Резьба и номер детали",
  air_filter: "Форма и размеры",
  cabin_filter: "Обычные и угольные",
  fuel_filter: "Тип топлива и соединение",
  spark_plugs: "Резьба и зазор",
  shock_absorbers: "Передние и задние стойки",
  belts: "Длина и число зубьев",
  engine_oil: "Вязкость и допуск двигателя",
  transmission_oil: "Для коробок и редукторов",
  antifreeze: "Допуск и температура замерзания",
  brake_fluid: "Класс DOT и объём",
  washer_fluid: "Летние и зимние составы",
  hydraulic_fluid: "Для усилителя руля и гидросистем",
  greases: "Для подшипников, шарниров и узлов",
  other_fluids: "По назначению и объёму",
  tires: "По размеру и сезону",
  wheels: "Диаметр, вылет и разболтовка",
  wiper_blades: "По длине и креплению",
  bulbs: "Тип цоколя и мощность",
  dashcams: "Разрешение и число камер",
  car_mats: "Для салона и багажника",
  seat_covers: "По материалу и комплекту",
  chargers: "Для зарядки и запуска авто",
  safety: "Комплект для автомобиля",
  roof_racks: "По креплению и нагрузке",
  compressors: "Давление и производительность",
  jacks: "Грузоподъёмность и высота",
  tool_sets: "По комплекту и посадочному размеру",
  tools: "Для обслуживания и ремонта",
  chem_engine: "Очистители для двигателя",
  chem_additives: "Для топлива и технических жидкостей",
  chem_body: "Мойка и защита кузова",
  chem_interior: "Уход за тканью, кожей и пластиком",
  chem_repair: "Для ремонта и защиты от коррозии",
  autochem: "По назначению и составу",
}

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
          const labelId = `${id}-group-${item.key}`
          const description = DESCRIPTIONS[item.key]
          return (
            <UnstyledButton
              key={item.key}
              className="parts-departments__group"
              data-product-group={item.key}
              data-active={isOn || undefined}
              aria-pressed={isOn}
              aria-labelledby={labelId}
              aria-describedby={description ? `${labelId}-description` : undefined}
              onClick={() => onSelect({ department: current, group: isOn ? null : item.key })}
            >
              <span className="parts-departments__media" aria-hidden="true">
                <ProductGroupArtwork group={item.key} fallback={<IconTool size={28} stroke={1.6} />} />
              </span>
              <span className="parts-departments__caption">
                <span id={labelId} className="parts-departments__label">{item.label}</span>
                {description && <span id={`${labelId}-description`} className="parts-departments__description">{description}</span>}
                <span className="parts-departments__action" aria-hidden="true">
                  {isOn ? <IconCheck size={16} stroke={1.8} /> : <IconArrowRight size={16} stroke={1.8} />}
                </span>
              </span>
            </UnstyledButton>
          )
        })}
      </div>
    </Box>
  )
}
