"use client"

import ProductGroupArtwork from "./ProductGroupArtwork"
import { Box, Group, Text, UnstyledButton } from "@mantine/core"
import {
  IconBattery3, IconBottle, IconCar, IconDisc, IconDroplet, IconFilter, IconFlask, IconLamp, IconSparkles,
  IconTool, IconWiper, IconCircleDot, IconEngine, IconSnowflake,
  IconArmchair, IconArrowBarUp, IconBolt, IconBucketDroplet, IconCamera, IconDroplets, IconFirstAidKit, IconHammer,
  IconLayout, IconPackage, IconSettings2, IconSpray, IconWind,
} from "@tabler/icons-react"
import { DEPARTMENTS, productGroupsOfDepartment, type DepartmentKey } from "@/lib/product-groups"

const GROUP_ICONS: Record<string, typeof IconCar> = {
  battery: IconBattery3, engine_oil: IconBottle, transmission_oil: IconBottle, antifreeze: IconSnowflake,
  brake_fluid: IconDroplet, washer_fluid: IconDroplet, tires: IconCircleDot, wheels: IconDisc,
  brake_pads: IconDisc, brake_discs: IconDisc, oil_filter: IconFilter, air_filter: IconFilter,
  cabin_filter: IconFilter, fuel_filter: IconFilter, spark_plugs: IconEngine, wiper_blades: IconWiper,
  bulbs: IconLamp, shock_absorbers: IconCar, autochem: IconFlask, tools: IconTool,
  hydraulic_fluid: IconDroplets, greases: IconBucketDroplet, other_fluids: IconDroplet,
  chem_engine: IconFlask, chem_additives: IconFlask, chem_body: IconSpray, chem_interior: IconSpray, chem_repair: IconSpray,
  dashcams: IconCamera, car_mats: IconLayout, seat_covers: IconArmchair, chargers: IconBolt, compressors: IconWind,
  jacks: IconArrowBarUp, safety: IconFirstAidKit, roof_racks: IconPackage, belts: IconSettings2, tool_sets: IconHammer,
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
            {item.key === "chemicals" ? <IconSparkles size={16} /> : null}
            {item.label}
          </UnstyledButton>
        ))}
      </Group>
      <div className="parts-departments__groups">
        {groups.map((item) => {
          const Icon = GROUP_ICONS[item.key] ?? IconTool
          const isOn = group === item.key
          return (
            <UnstyledButton
              key={item.key}
              className="parts-departments__group"
              data-active={isOn || undefined}
              aria-pressed={isOn}
              onClick={() => onSelect({ department: current, group: isOn ? null : item.key })}
            >
              <span className="parts-departments__icon"><ProductGroupArtwork group={item.key} fallback={<Icon size={22} stroke={1.6} />} /></span>
              <Text span size="sm" fw={700} lh={1.25}>{item.label}</Text>
            </UnstyledButton>
          )
        })}
      </div>
    </Box>
  )
}
