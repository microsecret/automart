"use client"

import {
  Stack,
  Text,
  Select,
  TextInput,
  Button,
  Divider,
  Group,
  NumberInput,
  Checkbox,
} from "@mantine/core"
import { IconX } from "@tabler/icons-react"
import { BRAND_NAMES, getModels } from "@/lib/catalog"
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants"

export interface FilterValues {
  q?: string
  make?: string
  model?: string
  bodyType?: string
  fuelType?: string
  transmission?: string
  city?: string
  priceFrom?: number
  priceTo?: number
  yearFrom?: number
  yearTo?: number
}

interface FiltersSidebarProps {
  values: FilterValues
  onChange: (next: FilterValues) => void
  onReset: () => void
  isVehicle: boolean
}

export default function FiltersSidebar({
  values,
  onChange,
  onReset,
  isVehicle,
}: FiltersSidebarProps) {
  const update = <K extends keyof FilterValues>(key: K, val: FilterValues[K]) => {
    onChange({ ...values, [key]: val })
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => String(currentYear - i))

  return (
    <Stack gap="xl">
      {/* Заголовок */}
      <Group justify="space-between">
        <Text fw={600} size="md">
          Фильтры
        </Text>
        <Button
          variant="subtle"
          color="gray"
          size="compact-xs"
          leftSection={<IconX size={14} />}
          onClick={onReset}
        >
          Сбросить
        </Button>
      </Group>

      {/* Марка */}
      <Divider labelPosition="center" label={<Text size="xs" fw={500} c="gray.5">Марка</Text>} />
      <Select
        placeholder="Любая"
        data={BRAND_NAMES.map((b) => ({ value: b, label: b }))}
        searchable
        clearable
        value={values.make || ""}
        onChange={(v) => update("make", v || undefined)}
      />

      {/* Модель (каскадно от марки) */}
      {values.make && getModels(values.make).length > 0 && (
        <Select
          placeholder="Любая модель"
          data={getModels(values.make).map((m) => ({ value: m, label: m }))}
          searchable
          clearable
          value={values.model || ""}
          onChange={(v) => update("model", v || undefined)}
        />
      )}

      {isVehicle && (
        <>
          {/* Кузов */}
          <Divider labelPosition="center" label={<Text size="xs" fw={500} c="gray.5">Кузов</Text>} />
          <Select
            placeholder="Любой"
            data={[...BODY_TYPES]}
            clearable
            value={values.bodyType || ""}
            onChange={(v) => update("bodyType", v || undefined)}
          />

          {/* Двигатель */}
          <Divider labelPosition="center" label={<Text size="xs" fw={500} c="gray.5">Двигатель</Text>} />
          <Select
            placeholder="Любой"
            data={[...FUEL_TYPES]}
            clearable
            value={values.fuelType || ""}
            onChange={(v) => update("fuelType", v || undefined)}
          />

          {/* Коробка */}
          <Divider labelPosition="center" label={<Text size="xs" fw={500} c="gray.5">Коробка передач</Text>} />
          <Select
            placeholder="Любая"
            data={[...TRANSMISSIONS]}
            clearable
            value={values.transmission || ""}
            onChange={(v) => update("transmission", v || undefined)}
          />
        </>
      )}

      {/* Цена */}
      <Divider labelPosition="center" label={<Text size="xs" fw={500} c="gray.5">Цена, ₽</Text>} />
      <Group grow>
        <NumberInput
          placeholder="от"
          value={values.priceFrom ?? ""}
          onChange={(v) => update("priceFrom", typeof v === "number" ? v : undefined)}
          thousandGroupSeparator=" "
          hideControls
        />
        <NumberInput
          placeholder="до"
          value={values.priceTo ?? ""}
          onChange={(v) => update("priceTo", typeof v === "number" ? v : undefined)}
          thousandGroupSeparator=" "
          hideControls
        />
      </Group>

      {isVehicle && (
        <>
          {/* Год */}
          <Divider labelPosition="center" label={<Text size="xs" fw={500} c="gray.5">Год выпуска</Text>} />
          <Group grow>
            <Select
              placeholder="от"
              data={yearOptions}
              searchable
              value={values.yearFrom ? String(values.yearFrom) : ""}
              onChange={(v) => update("yearFrom", v ? Number(v) : undefined)}
            />
            <Select
              placeholder="до"
              data={yearOptions}
              searchable
              value={values.yearTo ? String(values.yearTo) : ""}
              onChange={(v) => update("yearTo", v ? Number(v) : undefined)}
            />
          </Group>
        </>
      )}

      {/* Город */}
      <Divider labelPosition="center" label={<Text size="xs" fw={500} c="gray.5">Город</Text>} />
      <TextInput
        placeholder="Любой город"
        value={values.city || ""}
        onChange={(e) => update("city", e.currentTarget.value)}
      />

      {/* С фото только — опционально, заглушка */}
      <Checkbox label="Только с фото" color="indigo" defaultChecked />
    </Stack>
  )
}
