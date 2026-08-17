"use client"
import { useState, useMemo } from "react"
import useSWR from "swr"
import { Alert, Paper, Stack, Group, Text, Select, Divider, ThemeIcon, Box, Tooltip } from "@mantine/core"
import { IconCalculator, IconInfoCircle, IconShip, IconBuildingBank, IconTruckDelivery, IconCar, IconCheck, IconAlertTriangle, IconCoin } from "@tabler/icons-react"
import { formatPrice } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"
import { estimatedAuctionServiceFee } from "@/lib/auction-service-fee"

interface Props {
  make: string
  model: string
  year: number
  manufacturedMonth?: string | null
  engineVolume: number | null
  power: number | null
  fuelType: string | null
  sourcePrice: number
  sourceCurrency: string
  priceRub: number
  country: string
  pricingMode?: "PURCHASE" | "RENTAL_TRANSFER"
}

const CURRENT_YEAR = new Date().getFullYear()

type ExchangeRateResponse = {
  rates: Record<string, { rateToRub: number; source: string; updatedAt: string | null }>
  asOf: string | null
  stale: boolean
  missingCurrencies: string[]
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
function customsDuty(year: number, manufacturedMonth: string | null | undefined, volume: number, priceRub: number, eurRate: number) {
  const yearDifference = Math.max(0, CURRENT_YEAR - year)
  const currentMonth = new Date().getMonth() + 1
  const month = manufacturedMonth?.match(/^\d{4}-(\d{2})$/)?.[1]
  const manufacturedMonthNumber = month ? Number(month) : null
  const groups: Array<"UP_TO_3" | "OVER_3_TO_5" | "OVER_5"> = yearDifference <= 2
    ? ["UP_TO_3"]
    : yearDifference === 3
      ? manufacturedMonthNumber === null || manufacturedMonthNumber === currentMonth
        ? ["UP_TO_3", "OVER_3_TO_5"]
        : manufacturedMonthNumber < currentMonth ? ["OVER_3_TO_5"] : ["UP_TO_3"]
      : yearDifference <= 4
        ? ["OVER_3_TO_5"]
        : yearDifference === 5
          ? manufacturedMonthNumber === null || manufacturedMonthNumber === currentMonth
            ? ["OVER_3_TO_5", "OVER_5"]
            : manufacturedMonthNumber < currentMonth ? ["OVER_5"] : ["OVER_3_TO_5"]
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

/**
 * Preferential recycling fee for a vehicle imported by an individual for
 * personal use. Since 01.12.2025 the preferential coefficients also depend
 * on power. Above 160 hp (and when power is missing) the exact fee must be
 * calculated from the official table and confirmed from vehicle documents.
 */
function preferentialUtilizationFee(year: number, manufacturedMonth: string | null | undefined, power: number | null, isElectric: boolean) {
  if (isElectric || !power || power > 160) return null

  const yearDifference = Math.max(0, CURRENT_YEAR - year)
  const currentMonth = new Date().getMonth() + 1
  const month = manufacturedMonth?.match(/^\d{4}-(\d{2})$/)?.[1]
  const manufacturedMonthNumber = month ? Number(month) : null
  const ageGroups: Array<"UP_TO_3" | "OVER_3"> = yearDifference <= 2
    ? ["UP_TO_3"]
    : yearDifference === 3
      ? manufacturedMonthNumber === null || manufacturedMonthNumber === currentMonth
        ? ["UP_TO_3", "OVER_3"]
        : manufacturedMonthNumber < currentMonth ? ["OVER_3"] : ["UP_TO_3"]
      : ["OVER_3"]
  const amounts = ageGroups.map((group) => group === "UP_TO_3" ? 3_400 : 5_200)

  return {
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    boundary: amounts.length > 1,
  }
}

export default function AuctionCalculator({ make, model, year, manufacturedMonth, engineVolume, power, fuelType, sourcePrice, sourceCurrency, priceRub, country, pricingMode = "PURCHASE" }: Props) {
  const [city, setCity] = useState("Москва")
  const { data: exchangeRateData, error: exchangeRateError } = useSWR<ExchangeRateResponse>("/api/exchange-rates", fetchJson, { revalidateOnFocus: false })
  // Не подставляем вымышленный объём: от него напрямую зависит таможенная пошлина.
  // AuctionListing.engineVolume is normalized to cubic centimetres for every
  // source. Older partner feeds that send litres are normalized on import.
  const volume = typeof engineVolume === "number" && engineVolume > 0 ? Math.round(engineVolume) : null
  const sourceRate = exchangeRateData?.rates[sourceCurrency]?.rateToRub
  const eurRate = exchangeRateData?.rates.EUR?.rateToRub
  const effectivePriceRub = sourceRate && sourcePrice >= 0 ? Math.round(sourcePrice * sourceRate) : priceRub
  const isElectric = fuelType === "ELECTRIC"
  const hasEngineData = !isElectric && volume !== null
  const canCalculateCustomsDuty = hasEngineData && typeof eurRate === "number"
  const utilizationFee = preferentialUtilizationFee(year, manufacturedMonth, power, isElectric)

  const calc = useMemo(() => {
    const customs = canCalculateCustomsDuty && volume !== null && eurRate !== undefined
      ? customsDuty(year, manufacturedMonth, volume, effectivePriceRub, eurRate)
      : null
    const c = {
      auctionPrice: effectivePriceRub,
      auctionFee: auctionFee(effectivePriceRub),
      inlandDelivery: INLAND_DELIVERY[country] || 45000,
      seaDelivery: SEA_TO_VLAD[country] || 100000,
      utilizationFee,
      customsProcess: 15000, // Оформление на СВХ
      brokerFee: 30000, // Брокерские услуги
      svh: 25000, // Склад временного хранения (2 недели)
      rfDelivery: RF_CITIES.find((c) => c.value === city)?.deliveryFromVlad || 180000,
      ourCommission: estimatedAuctionServiceFee(effectivePriceRub),
    }

    const totalWithoutDuty =
      c.auctionPrice + c.auctionFee + c.inlandDelivery + c.seaDelivery +
      (c.utilizationFee?.min || 0) + c.customsProcess + c.brokerFee + c.svh + c.rfDelivery + c.ourCommission

    return {
      ...c,
      customs,
      totalWithoutDuty,
      totalMin: customs && c.utilizationFee ? totalWithoutDuty + customs.dutyMin : null,
      totalMax: customs && c.utilizationFee ? totalWithoutDuty + customs.dutyMax + (c.utilizationFee.max - c.utilizationFee.min) : null,
    }
  }, [effectivePriceRub, country, year, manufacturedMonth, volume, city, eurRate, canCalculateCustomsDuty, utilizationFee])

  const currencySymbol = sourceCurrency === "JPY" || sourceCurrency === "CNY" ? "¥" : sourceCurrency === "KRW" ? "₩" : sourceCurrency === "USD" ? "$" : sourceCurrency === "RUB" ? "₽" : "€"
  const countryLabel = country === "JP" ? "Япония" : country === "KR" ? "Корея" : country === "US" ? "США" : country === "CN" ? "Китай" : "Европа"
  const hasManufacturedMonth = Boolean(manufacturedMonth?.match(/^\d{4}-(0[1-9]|1[0-2])$/))
  const volumeLabel = isElectric ? "электро" : volume ? `${volume} см³` : "объём не указан"

  if (pricingMode === "RENTAL_TRANSFER") {
    return (
      <Paper radius="md" p="md" withBorder style={{ background: "linear-gradient(135deg, #eff6ff 0%, #fff 58%)", borderColor: "#bfdbfe" }}>
        <Stack gap="sm">
          <Group gap="sm" align="center">
            <ThemeIcon variant="light" color="blue" size={36} radius="md"><IconCalculator size={20} /></ThemeIcon>
            <Stack gap={0}>
              <Text fw={800} fz="md" c="dark.9">Расчёт регулярных платежей по аренде</Text>
              <Text size="xs" c="gray.5">{make} {model} · {year} · {countryLabel}</Text>
            </Stack>
          </Group>

          <Alert color="blue" variant="light" icon={<IconInfoCircle size={17} />}>
            <Text size="xs"><b>Это не цена продажи автомобиля.</b> Источник предлагает переоформление действующего договора аренды. Ниже показан расчётный остаток платежей с учётом опубликованной компенсации.</Text>
          </Alert>

          {(exchangeRateError || exchangeRateData?.stale) && (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={17} />}>
              Курс ЦБ сейчас не подтверждён как свежий. Рублёвый эквивалент нужно перепроверить перед оформлением.
            </Alert>
          )}

          <Divider my="xs" />
          <Stack gap={6}>
            <CostRow icon={<IconCoin size={14} />} label={`Расчётный остаток регулярных платежей (${sourceCurrency})`} value={`${sourcePrice.toLocaleString("ru-RU")} ${currencySymbol}`} muted />
            <CostRow icon={<IconCoin size={14} />} label="Эквивалент в рублях по курсу ЦБ" value={formatPrice(effectivePriceRub)} muted />
            <CostRow icon={<IconBuildingBank size={14} />} label="Выкуп автомобиля" value="Нужно подтвердить" highlight />
            <CostRow icon={<IconShip size={14} />} label="Экспорт, таможня и доставка" value="Не рассчитаны" highlight />
          </Stack>

          <Alert color="red" variant="light" icon={<IconAlertTriangle size={17} />}>
            <Text size="xs"><b>Итог «под ключ» не показывается.</b> Сначала нужно подтвердить право выкупа, переход собственности и возможность экспорта этого автомобиля из Кореи.</Text>
          </Alert>

          <Group gap={6}>
            <IconInfoCircle size={14} color="#94a3b8" />
            <Text size="10px" c="gray.5">{sourceRate ? `Курс ЦБ: ${sourceRate.toFixed(4)} ₽ за ${sourceCurrency}${exchangeRateData?.asOf ? `, обновлён ${new Date(exchangeRateData.asOf).toLocaleString("ru-RU")}` : ""}.` : "Использован рублёвый снимок лота; курс требует проверки."}</Text>
          </Group>
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper radius="md" p="md" withBorder style={{ background: "linear-gradient(135deg, #fff7ed 0%, #fff 50%)" }}>
      <Stack gap="sm">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="orange" size={36} radius="md"><IconCalculator size={20} /></ThemeIcon>
          <Stack gap={0}>
            <Text fw={800} fz="md" c="dark.9">Калькулятор стоимости под ключ</Text>
            <Text size="xs" c="gray.5">{make} {model} · {year} · {volumeLabel} · {countryLabel}</Text>
          </Stack>
        </Group>

        <Alert color="orange" variant="light" icon={<IconInfoCircle size={17} />}>
          <Text size="xs">
            <b>Предварительный просмотр стоимости.</b> Сумма ниже — ориентировочная цена под ключ, а не оферта: курс, фрахт, таможенная стоимость и тарифы подтверждаются перед сделкой.
          </Text>
        </Alert>

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

        {exchangeRateData?.stale && (
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={17} />}>
            Курсы ЦБ старше 36 часов или набор валют неполный. Итог не используйте для оплаты до автоматического обновления курса.
          </Alert>
        )}

        {!hasEngineData && (
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={17} />}>
            <Text size="xs">
              <b>{isElectric ? "Электромобиль." : "Объём двигателя не указан."}</b>{" "}
              {isElectric
                ? "Для электромобиля правила и платежи зависят от подтверждённых характеристик и статуса ввоза. Не показываем недостоверную сумму «под ключ»."
                : "Не подставляем условные 2,0 л: без подтверждённого объёма нельзя корректно рассчитать таможенную пошлину."}
            </Text>
          </Alert>
        )}

        {hasEngineData && eurRate === undefined && (
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={17} />}>
            <Text size="xs"><b>Нет актуального курса EUR от ЦБ.</b> Таможенная пошлина и итог «под ключ» не рассчитываются до обновления официального курса.</Text>
          </Alert>
        )}

        {calc.customs?.requiresManufactureDate && (
          <Paper radius="sm" p="xs" style={{ background: "var(--market-caution-surface)", borderColor: "var(--market-caution-line)", borderWidth: 1, borderStyle: "solid" }}>
            <Group gap="sm">
              <IconAlertTriangle size={18} color="#d97706" />
              <Text size="xs" c="#92400e">
                <b>{hasManufacturedMonth ? "Пограничный месяц." : "Пограничный год."}</b>{" "}
                {hasManufacturedMonth
                  ? `В источнике указан ${manufacturedMonth}; день выпуска не указан. Поэтому показываем диапазон пошлины: ${calc.customs.category}.`
                  : `В источнике указан только ${year} год выпуска. До подтверждения месяца выпуска показываем диапазон пошлины: ${calc.customs.category}.`}
              </Text>
            </Group>
          </Paper>
        )}
        {calc.customs && !calc.customs.requiresManufactureDate && (
          <Paper radius="sm" p="xs" style={{ background: "var(--market-success-surface)", borderColor: "var(--market-success-line)", borderWidth: 1, borderStyle: "solid" }}>
            <Group gap="sm">
              <IconCheck size={18} color="#059669" />
              <Text size="xs" c="#15803d"><b>Таможенная категория:</b> {calc.customs.category}. Расчёт предварительный и требует сверки даты выпуска и документов.</Text>
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
          {calc.customs ? (
            <CostRow
              icon={<IconBuildingBank size={14} />}
              label={
                <Group gap={4}>
                  <Text size="sm" c="gray.6">Таможенная пошлина</Text>
                  <Tooltip label={`Категория: ${calc.customs.category}. Объём: ${volume} см³. Формула: ${calc.customs.formula}. Курс EUR: ${eurRate?.toFixed(2)} ₽.`}>
                    <IconInfoCircle size={13} color="#a1a1aa" style={{ cursor: "help" }} />
                  </Tooltip>
                </Group>
              }
              value={calc.customs.dutyMin === calc.customs.dutyMax ? formatPrice(calc.customs.dutyMin) : `${formatPrice(calc.customs.dutyMin)} — ${formatPrice(calc.customs.dutyMax)}`}
              highlight
            />
          ) : (
            <CostRow icon={<IconBuildingBank size={14} />} label="Таможенная пошлина" value="Требуется сверка" highlight />
          )}
          <CostRow
            icon={<IconBuildingBank size={14} />}
            label={
              <Group gap={4}>
                <Text size="sm" c="gray.6">Утилизационный сбор</Text>
                <Tooltip label="Льготные 3 400/5 200 ₽ применимы к личному ввозу автомобиля мощностью не более 160 л.с. при соблюдении условий владения. С 01.12.2025 для большей мощности действуют иные коэффициенты.">
                  <IconInfoCircle size={13} color="#a1a1aa" style={{ cursor: "help" }} />
                </Tooltip>
              </Group>
            }
            value={calc.utilizationFee
              ? calc.utilizationFee.min === calc.utilizationFee.max
                ? formatPrice(calc.utilizationFee.min)
                : `${formatPrice(calc.utilizationFee.min)} — ${formatPrice(calc.utilizationFee.max)}`
              : "Требуется проверка"}
            highlight={!calc.utilizationFee}
          />
          <CostRow icon={<IconBuildingBank size={14} />} label="Таможенное оформление (СВХ)" value={formatPrice(calc.customsProcess)} />
          <CostRow icon={<IconBuildingBank size={14} />} label="Брокерские услуги" value={formatPrice(calc.brokerFee)} />
          <CostRow icon={<IconBuildingBank size={14} />} label="Склад временного хранения" value={formatPrice(calc.svh)} />
          <CostRow icon={<IconTruckDelivery size={14} />} label={`Доставка Владивосток → ${city}`} value={formatPrice(calc.rfDelivery)} />
          <CostRow icon={<IconCheck size={14} />} label="Ориентировочная комиссия сервиса" value={formatPrice(calc.ourCommission)} />
        </Stack>

        <Divider my="xs" />

        {/* Итог */}
        <Paper radius="md" p="md" style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}>
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Text size="xs" c="rgba(255,255,255,0.85)">{calc.totalMin === null ? `Известная часть расходов в ${city}` : `Ориентировочная цена под ключ в ${city}`}</Text>
              <Text size="xs" c="rgba(255,255,255,0.7)">{calc.totalMin === null ? "для полного итога нужны пошлина и утильсбор по документам" : "цена авто + логистика + таможенный сценарий + РФ"}</Text>
            </Stack>
            <Text fw={800} fz="1.1rem" c="white" ff="var(--font-display),sans-serif" lh={1}>{calc.totalMin === null || calc.totalMax === null ? formatPrice(calc.totalWithoutDuty) : calc.totalMin === calc.totalMax ? formatPrice(calc.totalMin) : `${formatPrice(calc.totalMin)} — ${formatPrice(calc.totalMax)}`}</Text>
          </Group>
        </Paper>

        <Group gap={6}>
          <IconInfoCircle size={14} color="#a1a1aa" />
          <Text size="10px" c="gray.4">Плановый расчёт, не оферта и не платёжное требование. {sourceRate ? `Курс ЦБ: ${sourceRate.toFixed(4)} ₽ за ${sourceCurrency}${exchangeRateData?.asOf ? `, обновлён ${new Date(exchangeRateData.asOf).toLocaleString("ru-RU")}` : ""}. ` : "Использован курс из снимка лота. "}Таможенная стоимость, утильсбор, тарифы перевозчика, брокера и СВХ подтверждаются перед сделкой.</Text>
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
