"use client"
import { useState, useMemo } from "react"
import useSWR from "swr"
import { Alert, Paper, Stack, Group, Text, Select, Divider, ThemeIcon, Box, Tooltip } from "@mantine/core"
import { IconCalculator, IconInfoCircle, IconShip, IconBuildingBank, IconTruckDelivery, IconCar, IconCheck, IconAlertTriangle, IconCoin } from "@tabler/icons-react"
import { formatPrice } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"

interface Props {
  make: string
  model: string
  year: number
  engineVolume: number | null
  power: number | null
  fuelType: string | null
  sourcePrice: number
  sourceCurrency: string
  priceRub: number
  country: string
}

const CURRENT_YEAR = new Date().getFullYear()

type ExchangeRateResponse = {
  rates: Record<string, { rateToRub: number; source: string; updatedAt: string | null }>
}

// Города РФ с ценой доставки из Владивостока (в рублях)
const RF_CITIES = [
  { value: "Владивосток", label: "Владивосток", deliveryFromVlad: 0 },
  { value: "Хабаровск", label: "Хабаровск", deliveryFromVlad: 25000 },
  { value: "Москва", label: "Москва", deliveryFromVlad: 180000 },
  { value: "Санкт-Петербург", label: "Санкт-Петербург", deliveryFromVlad: 195000 },
  { value: "Екатеринбург", label: "Екатеринбург", deliveryFromVlad: 160000 },
  { value: "Новосибирск", label: "Новосибирск", deliveryFromVlad: 130000 },
  { value: "Красноярск", label: "Красноярск", deliveryFromVlad: 110000 },
  { value: "Иркутск", label: "Иркутск", deliveryFromVlad: 90000 },
  { value: "Чита", label: "Чита", deliveryFromVlad: 75000 },
  { value: "Якутск", label: "Якутск", deliveryFromVlad: 120000 },
  { value: "Краснодар", label: "Краснодар", deliveryFromVlad: 200000 },
  { value: "Сочи", label: "Сочи", deliveryFromVlad: 205000 },
  { value: "Казань", label: "Казань", deliveryFromVlad: 170000 },
  { value: "Самара", label: "Самара", deliveryFromVlad: 175000 },
  { value: "Уфа", label: "Уфа", deliveryFromVlad: 165000 },
]

// Стоимость доставки внутри страны-источника до порта (в рублях)
const INLAND_DELIVERY: Record<string, number> = {
  JP: 40000,   // Япония — до порта
  KR: 35000,   // Корея — до порта
  US: 60000,   // США — до порта (дальше)
  DE: 45000,   // Европа — до порта
}

// Морская доставка до Владивостока (в рублях)
const SEA_TO_VLAD: Record<string, number> = {
  JP: 75000,
  KR: 70000,
  US: 280000,  // Через Транзитный коридор
  DE: 250000,  // Через Суэц/СПб
}

// Аукционный сбор (зависит от цены, в рублях)
function auctionFee(priceRub: number): number {
  if (priceRub < 500000) return 25000
  if (priceRub < 1500000) return 40000
  if (priceRub < 3000000) return 60000
  return 90000
}

type CustomsScenario = {
  duty: number
  label: string
  formula: string
}

function engineRate(volume: number, rates: readonly [number, number][]) {
  return rates.find(([limit]) => volume <= limit)?.[1] || rates[rates.length - 1][1]
}

function customsDutyForAgeGroup(group: "UP_TO_3" | "OVER_3_TO_5" | "OVER_5", volume: number, priceRub: number, eurRate: number): CustomsScenario {
  if (group === "UP_TO_3") {
    const priceEur = priceRub / eurRate
    const [ratePercent, minimumRate] = priceEur <= 8_500 ? [0.54, 2.5]
      : priceEur <= 16_700 ? [0.48, 3.5]
        : priceEur <= 42_300 ? [0.48, 5.5]
          : priceEur <= 84_500 ? [0.48, 7.5]
            : priceEur <= 169_000 ? [0.48, 15]
              : [0.48, 20]
    return {
      duty: Math.round(Math.max(priceRub * ratePercent, volume * minimumRate * eurRate)),
      label: "до 3 лет",
      formula: `${Math.round(ratePercent * 100)}% от стоимости, но не менее €${minimumRate}/см³`,
    }
  }

  const rate = group === "OVER_3_TO_5"
    ? engineRate(volume, [[1_000, 1.5], [1_500, 1.7], [1_800, 2.5], [2_300, 2.7], [3_000, 3], [Infinity, 3.6]])
    : engineRate(volume, [[1_000, 3], [1_500, 3.2], [1_800, 3.5], [2_300, 4.8], [3_000, 5], [Infinity, 5.7]])
  return {
    duty: Math.round(volume * rate * eurRate),
    label: group === "OVER_3_TO_5" ? "более 3, не более 5 лет" : "более 5 лет",
    formula: `${volume.toLocaleString("ru")} см³ × €${rate}/см³ × курс EUR`,
  }
}

/**
 * A listing stores only its year, not its exact release date. At a 3- or
 * 5-year boundary the calculator must disclose a range instead of choosing a
 * favourable customs rate. Rates: EEC Council Decision No. 107, Appendix 2.
 */
function customsDuty(year: number, volume: number, priceRub: number, eurRate: number) {
  const yearDifference = Math.max(0, CURRENT_YEAR - year)
  const groups: Array<"UP_TO_3" | "OVER_3_TO_5" | "OVER_5"> = yearDifference <= 2
    ? ["UP_TO_3"]
    : yearDifference === 3
      ? ["UP_TO_3", "OVER_3_TO_5"]
      : yearDifference <= 4
        ? ["OVER_3_TO_5"]
        : yearDifference === 5
          ? ["OVER_3_TO_5", "OVER_5"]
          : ["OVER_5"]
  const scenarios = groups.map((group) => customsDutyForAgeGroup(group, volume, priceRub, eurRate))
  const duties = scenarios.map((scenario) => scenario.duty)
  return {
    dutyMin: Math.min(...duties),
    dutyMax: Math.max(...duties),
    category: scenarios.map((scenario) => scenario.label).join(" / "),
    formula: scenarios.map((scenario) => scenario.formula).join("; "),
    requiresManufactureDate: scenarios.length > 1,
  }
}

export default function AuctionCalculator({ make, model, year, engineVolume, power, fuelType, sourcePrice, sourceCurrency, priceRub, country }: Props) {
  const [city, setCity] = useState("Москва")
  const { data: exchangeRateData, error: exchangeRateError } = useSWR<ExchangeRateResponse>("/api/exchange-rates", fetchJson, { revalidateOnFocus: false })
  const volume = Math.round((engineVolume || 2.0) * 1000) // куб.см
  const sourceRate = exchangeRateData?.rates[sourceCurrency]?.rateToRub
  const eurRate = exchangeRateData?.rates.EUR?.rateToRub || 102
  const effectivePriceRub = sourceRate && sourcePrice >= 0 ? Math.round(sourcePrice * sourceRate) : priceRub

  const calc = useMemo(() => {
    const customs = customsDuty(year, volume, effectivePriceRub, eurRate)
    const c = {
      auctionPrice: effectivePriceRub,
      auctionFee: auctionFee(effectivePriceRub),
      inlandDelivery: INLAND_DELIVERY[country] || 45000,
      seaDelivery: SEA_TO_VLAD[country] || 100000,
      ...customs,
      utilFee: 3400, // Утилизационный сбор для физлиц (3400₽)
      customsProcess: 15000, // Оформление на СВХ
      brokerFee: 30000, // Брокерские услуги
      svh: 25000, // Склад временного хранения (2 недели)
      rfDelivery: RF_CITIES.find((c) => c.value === city)?.deliveryFromVlad || 180000,
      ourCommission: effectivePriceRub > 2000000 ? 150000 : 80000,
    }

    const totalWithoutDuty =
      c.auctionPrice + c.auctionFee + c.inlandDelivery + c.seaDelivery +
      c.utilFee + c.customsProcess + c.brokerFee + c.svh + c.rfDelivery + c.ourCommission

    return { ...c, totalMin: totalWithoutDuty + c.dutyMin, totalMax: totalWithoutDuty + c.dutyMax }
  }, [effectivePriceRub, country, year, volume, city, eurRate])

  const currencySymbol = sourceCurrency === "JPY" || sourceCurrency === "CNY" ? "¥" : sourceCurrency === "KRW" ? "₩" : sourceCurrency === "USD" ? "$" : sourceCurrency === "RUB" ? "₽" : "€"
  const countryLabel = country === "JP" ? "Япония" : country === "KR" ? "Корея" : country === "US" ? "США" : country === "CN" ? "Китай" : country === "DE" ? "Германия" : "Европа"
  const isElectric = fuelType === "ELECTRIC"

  return (
    <Paper radius="md" p="md" withBorder style={{ background: "linear-gradient(135deg, #fff7ed 0%, #fff 50%)" }}>
      <Stack gap="sm">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="orange" size={36} radius="md"><IconCalculator size={20} /></ThemeIcon>
          <Stack gap={0}>
            <Text fw={800} fz="md" c="dark.9">Калькулятор стоимости под ключ</Text>
            <Text size="xs" c="gray.5">{make} {model} · {year} · {volume} см³ · {countryLabel}</Text>
          </Stack>
        </Group>

        {/* Выбор города */}
        <Select
          label="Город доставки в РФ"
          data={RF_CITIES.map((c) => ({ value: c.value, label: c.label }))}
          value={city}
          onChange={(value) => setCity(value || "Москва")}
          size="sm"
          searchable
          description="Выберите город — пересчитаем доставку"
        />

        {exchangeRateError && (
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={17} />}>
            Курсы ЦБ сейчас не обновились. Показана ориентировочная стоимость из данных лота; не используйте её для оплаты без подтверждения менеджером.
          </Alert>
        )}

        {!isElectric && calc.requiresManufactureDate && (
          <Paper radius="sm" p="xs" style={{ background: "#fef3c7", borderColor: "#fde68a", borderWidth: 1, borderStyle: "solid" }}>
            <Group gap="sm">
              <IconAlertTriangle size={18} color="#d97706" />
              <Text size="xs" c="#92400e">
                <b>Пограничный год.</b> В источнике указан только {year} год выпуска. До подтверждения месяца выпуска показываем диапазон пошлины: {calc.category}.
              </Text>
            </Group>
          </Paper>
        )}
        {!isElectric && !calc.requiresManufactureDate && (
          <Paper radius="sm" p="xs" style={{ background: "#f0fdf4", borderColor: "#bbf7d0", borderWidth: 1, borderStyle: "solid" }}>
            <Group gap="sm">
              <IconCheck size={18} color="#059669" />
              <Text size="xs" c="#15803d"><b>Таможенная категория:</b> {calc.category}. Расчёт предварительный и требует сверки даты выпуска и документов.</Text>
            </Group>
          </Paper>
        )}

        <Divider my="xs" />

        {/* Детализация расходов */}
        <Stack gap={6}>
          <CostRow icon={<IconCoin size={14} />} label={`Цена аукциона (${sourceCurrency})`} value={`${sourcePrice.toLocaleString()} ${currencySymbol}`} muted />
          <CostRow icon={<IconCoin size={14} />} label="Цена в рублях (по курсу)" value={formatPrice(calc.auctionPrice)} muted />
          <CostRow icon={<IconCar size={14} />} label="Аукционный сбор" value={formatPrice(calc.auctionFee)} />
          <CostRow icon={<IconTruckDelivery size={14} />} label={`Доставка по ${countryLabel} до порта`} value={formatPrice(calc.inlandDelivery)} />
          <CostRow icon={<IconShip size={14} />} label="Морская доставка до Владивостока" value={formatPrice(calc.seaDelivery)} />
          {!isElectric && (
            <CostRow
              icon={<IconBuildingBank size={14} />}
              label={
                <Group gap={4}>
                  <Text size="sm" c="gray.6">Таможенная пошлина</Text>
                  <Tooltip label={`Категория: ${calc.category}. Объём: ${volume} см³. Формула: ${calc.formula}. Курс EUR: ${eurRate.toFixed(2)} ₽.`}>
                    <IconInfoCircle size={13} color="#a1a1aa" style={{ cursor: "help" }} />
                  </Tooltip>
                </Group>
              }
              value={calc.dutyMin === calc.dutyMax ? formatPrice(calc.dutyMin) : `${formatPrice(calc.dutyMin)} — ${formatPrice(calc.dutyMax)}`}
              highlight
            />
          )}
          <CostRow icon={<IconBuildingBank size={14} />} label="Утилизационный сбор" value={formatPrice(calc.utilFee)} />
          <CostRow icon={<IconBuildingBank size={14} />} label="Таможенное оформление (СВХ)" value={formatPrice(calc.customsProcess)} />
          <CostRow icon={<IconBuildingBank size={14} />} label="Брокерские услуги" value={formatPrice(calc.brokerFee)} />
          <CostRow icon={<IconBuildingBank size={14} />} label="Склад временного хранения" value={formatPrice(calc.svh)} />
          <CostRow icon={<IconTruckDelivery size={14} />} label={`Доставка Владивосток → ${city}`} value={formatPrice(calc.rfDelivery)} />
          <CostRow icon={<IconCheck size={14} />} label="Комиссия сервиса" value={formatPrice(calc.ourCommission)} />
        </Stack>

        <Divider my="xs" />

        {/* Итог */}
        <Paper radius="md" p="md" style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}>
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Text size="xs" c="rgba(255,255,255,0.85)">Предварительно под ключ в {city}</Text>
              <Text size="xs" c="rgba(255,255,255,0.7)">цена авто + логистика + таможенный сценарий + РФ</Text>
            </Stack>
            <Text fw={800} fz="1.1rem" c="white" ff="var(--font-display),sans-serif" lh={1}>{calc.totalMin === calc.totalMax ? formatPrice(calc.totalMin) : `${formatPrice(calc.totalMin)} — ${formatPrice(calc.totalMax)}`}</Text>
          </Group>
        </Paper>

        <Group gap={6}>
          <IconInfoCircle size={14} color="#a1a1aa" />
          <Text size="10px" c="gray.4">Плановый расчёт, не оферта и не платёжное требование. {sourceRate ? `Курс ЦБ: ${sourceRate.toFixed(4)} ₽ за ${sourceCurrency}. ` : "Использован курс из снимка лота. "}Таможенная стоимость, тарифы перевозчика, брокера и СВХ подтверждаются перед сделкой.</Text>
        </Group>
      </Stack>
    </Paper>
  )
}

function CostRow({ icon, label, value, muted, highlight }: { icon: React.ReactNode; label: React.ReactNode; value: string; muted?: boolean; highlight?: boolean }) {
  return (
    <Group justify="space-between" gap="sm">
      <Group gap={6}>
        <Box c={highlight ? "orange" : "gray.4"}>{icon}</Box>
        {typeof label === "string" ? <Text size="sm" c={muted ? "gray.5" : "gray.6"}>{label}</Text> : label}
      </Group>
      <Text size="sm" fw={highlight ? 700 : 600} c={highlight ? "#ea580c" : "dark.9"}>{value}</Text>
    </Group>
  )
}
