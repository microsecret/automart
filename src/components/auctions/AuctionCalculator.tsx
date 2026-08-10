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

// Таможенная пошлина для физических лиц (старше 3 лет)
// Источник: ЕАЭС, единые ставки для физлиц
function customsDuty(year: number, volume: number, priceRub: number, eurRate: number): { duty: number; category: string; ageLabel: string; isProkhodnoy: boolean } {
  const age = CURRENT_YEAR - year

  // Возрастные категории
  let rate: number // € за куб.см
  let category = ""
  let ageLabel = ""

  if (age <= 3) {
    // До 3 лет — 48% от стоимости, но не менее €2.5-5.7 за куб.см
    category = "до 3 лет"
    ageLabel = `${age} ${age === 1 ? "год" : "года"}`
    const minRate = volume <= 1000 ? 1.5 : volume <= 1500 ? 2.2 : volume <= 1800 ? 2.7 : volume <= 2300 ? 3.7 : 5.7
    const byValue = priceRub * 0.48
    const byVolume = volume * minRate * eurRate
    return { duty: Math.round(Math.max(byValue, byVolume)), category, ageLabel, isProkhodnoy: true }
  } else if (age <= 5) {
    // 3-5 лет
    category = "3-5 лет"
    ageLabel = `${age} лет`
    if (volume <= 1000) rate = 1.5
    else if (volume <= 1500) rate = 1.7
    else if (volume <= 1800) rate = 2.5
    else if (volume <= 2300) rate = 2.7
    else if (volume <= 3000) rate = 3.0
    else rate = 3.6
    return { duty: Math.round(volume * rate * eurRate), category, ageLabel, isProkhodnoy: age === 5 ? false : true }
  } else if (age <= 7) {
    // 5-7 лет
    category = "5-7 лет"
    ageLabel = `${age} лет`
    if (volume <= 1000) rate = 1.7
    else if (volume <= 1500) rate = 1.9
    else if (volume <= 1800) rate = 2.8
    else if (volume <= 2300) rate = 3.0
    else if (volume <= 3000) rate = 3.4
    else rate = 5.7
    return { duty: Math.round(volume * rate * eurRate), category, ageLabel, isProkhodnoy: false }
  } else {
    // Старше 7 лет
    category = "старше 7 лет"
    ageLabel = `${age} лет`
    if (volume <= 1000) rate = 3.0
    else if (volume <= 1500) rate = 3.2
    else if (volume <= 1800) rate = 3.5
    else if (volume <= 2300) rate = 4.8
    else if (volume <= 3000) rate = 5.0
    else rate = 5.7
    return { duty: Math.round(volume * rate * eurRate), category, ageLabel, isProkhodnoy: false }
  }
}

export default function AuctionCalculator({ make, model, year, engineVolume, power, fuelType, sourcePrice, sourceCurrency, priceRub, country }: Props) {
  const [city, setCity] = useState("Москва")
  const { data: exchangeRateData, error: exchangeRateError } = useSWR<ExchangeRateResponse>("/api/exchange-rates", fetchJson, { revalidateOnFocus: false })
  const volume = Math.round((engineVolume || 2.0) * 1000) // куб.см
  const age = CURRENT_YEAR - year
  const sourceRate = exchangeRateData?.rates[sourceCurrency]?.rateToRub
  const eurRate = exchangeRateData?.rates.EUR?.rateToRub || 102
  const effectivePriceRub = sourceRate && sourcePrice >= 0 ? Math.round(sourcePrice * sourceRate) : priceRub

  const calc = useMemo(() => {
    const c = {
      auctionPrice: effectivePriceRub,
      auctionFee: auctionFee(effectivePriceRub),
      inlandDelivery: INLAND_DELIVERY[country] || 45000,
      seaDelivery: SEA_TO_VLAD[country] || 100000,
      ...customsDuty(year, volume, effectivePriceRub, eurRate),
      utilFee: 3400, // Утилизационный сбор для физлиц (3400₽)
      customsProcess: 15000, // Оформление на СВХ
      brokerFee: 30000, // Брокерские услуги
      svh: 25000, // Склад временного хранения (2 недели)
      rfDelivery: RF_CITIES.find((c) => c.value === city)?.deliveryFromVlad || 180000,
      ourCommission: effectivePriceRub > 2000000 ? 150000 : 80000,
    }

    const total =
      c.auctionPrice + c.auctionFee + c.inlandDelivery + c.seaDelivery +
      c.duty + c.utilFee + c.customsProcess + c.brokerFee + c.svh + c.rfDelivery + c.ourCommission

    return { ...c, total }
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

        {/* Предупреждение о проходном годе */}
        {calc.isProkhodnoy === false && !isElectric && (
          <Paper radius="sm" p="xs" style={{ background: "#fef3c7", borderColor: "#fde68a", borderWidth: 1, borderStyle: "solid" }}>
            <Group gap="sm">
              <IconAlertTriangle size={18} color="#d97706" />
              <Text size="xs" c="#92400e">
                <b>Непроходной год!</b> Авто {calc.ageLabel} — повышенная пошлина (категория {calc.category}).
                Регистрация возможна после {CURRENT_YEAR - year + 3} года.
              </Text>
            </Group>
          </Paper>
        )}
        {calc.isProkhodnoy === true && age <= 5 && !isElectric && (
          <Paper radius="sm" p="xs" style={{ background: "#f0fdf4", borderColor: "#bbf7d0", borderWidth: 1, borderStyle: "solid" }}>
            <Group gap="sm">
              <IconCheck size={18} color="#059669" />
              <Text size="xs" c="#15803d"><b>Проходной год!</b> {calc.ageLabel} — льготная пошлина.</Text>
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
                  <Tooltip label={`Возраст: ${calc.ageLabel} (${calc.category}). Объём: ${volume} см³. Расчёт: ${volume} × ставка × ${eurRate.toFixed(2)} ₽`}>
                    <IconInfoCircle size={13} color="#a1a1aa" style={{ cursor: "help" }} />
                  </Tooltip>
                </Group>
              }
              value={formatPrice(calc.duty)}
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
              <Text size="xs" c="rgba(255,255,255,0.85)">Итого под ключ в {city}</Text>
              <Text size="xs" c="rgba(255,255,255,0.7)">цена авто + доставка + таможня + РФ</Text>
            </Stack>
            <Text fw={800} fz="1.5rem" c="white" ff="var(--font-display),sans-serif" lh={1}>{formatPrice(calc.total)}</Text>
          </Group>
        </Paper>

        <Group gap={6}>
          <IconInfoCircle size={14} color="#a1a1aa" />
          <Text size="10px" c="gray.4">Предварительный расчёт. {sourceRate ? `Курс ЦБ: ${sourceRate.toFixed(4)} ₽ за ${sourceCurrency}. ` : "Использован курс из снимка лота. "}Точная стоимость подтверждается после заявки.</Text>
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
