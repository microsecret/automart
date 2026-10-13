"use client"

import { Alert, Anchor, Badge, Box, Group, NumberInput, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core"
import { IconBarcode, IconShieldCheck } from "@tabler/icons-react"
import { CONFORMITY_REGISTRY_URL, CONFORMITY_TYPES, countryLabel, legalRules } from "@/lib/product-legal"

export type LegalFormValues = {
  gtin: string
  manufacturerInfo: string
  originCountry: string
  warrantyMonths: string | number
  shelfLife: string
  safetyInfo: string
  conformityType: string
  conformityRegulation: string
  conformityNumber: string
  conformityValidUntil: string
  conformityUrl: string
}

export const EMPTY_LEGAL: LegalFormValues = {
  gtin: "", manufacturerInfo: "", originCountry: "", warrantyMonths: "", shelfLife: "", safetyInfo: "",
  conformityType: "", conformityRegulation: "", conformityNumber: "", conformityValidUntil: "", conformityUrl: "",
}

export function legalToForm(part: Partial<Record<keyof LegalFormValues, unknown>>): LegalFormValues {
  const str = (value: unknown) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value))
  return {
    gtin: str(part.gtin),
    manufacturerInfo: str(part.manufacturerInfo),
    originCountry: countryLabel(str(part.originCountry)) ?? "",
    warrantyMonths: typeof part.warrantyMonths === "number" ? part.warrantyMonths : "",
    shelfLife: str(part.shelfLife),
    safetyInfo: str(part.safetyInfo),
    conformityType: str(part.conformityType),
    conformityRegulation: str(part.conformityRegulation),
    conformityNumber: str(part.conformityNumber),
    conformityValidUntil: str(part.conformityValidUntil).slice(0, 10),
    conformityUrl: str(part.conformityUrl),
  }
}

const COUNTRIES = ["Россия", "Китай", "Корея", "Япония", "Германия", "Беларусь", "Турция", "Италия", "Франция", "США", "Польша", "Чехия", "Индия", "Тайвань", "Бельгия", "Нидерланды", "ОАЭ"]

/**
 * Документы и гарантия — то, что закон требует сообщить покупателю.
 *
 * Поля подстраиваются под товарную группу: у масла и шин — штрихкод для
 * «Честного знака», у колодок и фильтров — сертификат по ТР ТС 018/2011,
 * у масел и жидкостей — декларация по ТР ТС 030/2012 и срок годности.
 * Где документ не нужен, блок не требует его, но даёт указать.
 */
export default function ProductLegalFields({ group, condition, values, errors, onChange }: {
  group: string | null
  condition: string
  values: LegalFormValues
  errors: Record<string, string>
  onChange: (next: LegalFormValues) => void
}) {
  const rules = legalRules(group)
  const set = <K extends keyof LegalFormValues>(key: K, value: LegalFormValues[K]) => onChange({ ...values, [key]: value })
  const isNew = condition !== "USED"
  const needsDocument = Boolean(rules.conformity) && isNew

  return (
    <Box>
      <Group gap="xs" mb={4}>
        <IconShieldCheck size={18} />
        <Text fw={800} size="sm">Документы и гарантия</Text>
        {rules.marking === "required" && <Badge size="sm" color="orange" variant="light">Маркировка «Честный знак»</Badge>}
        {rules.conformity && <Badge size="sm" color="indigo" variant="light">{rules.conformity.regulation}</Badge>}
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        Эти сведения покупатель обязан видеть до покупки (закон о защите прав потребителей, ст. 10 и 26.1).
      </Text>

      <Stack gap="sm">
        {(rules.marking === "required" || rules.marking === "check" || values.gtin) && (
          <TextInput
            label="Штрихкод (GTIN / EAN)"
            leftSection={<IconBarcode size={16} />}
            inputMode="numeric"
            placeholder="4607001234567"
            required={rules.marking === "required" && isNew}
            description={rules.marking === "required"
              ? "Товар подлежит маркировке: продавать его можно только с кодом «Честного знака», а выводить из оборота — через кассу или личный кабинет"
              : "Может подлежать маркировке — уточните у поставщика"}
            value={values.gtin}
            onChange={(event) => set("gtin", event.currentTarget.value.replace(/[^\d]/g, ""))}
            error={errors.gtin}
          />
        )}

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <Select
            label="Страна производства"
            data={COUNTRIES}
            searchable
            clearable
            placeholder="Выберите или введите"
            value={values.originCountry || null}
            onChange={(value) => set("originCountry", value ?? "")}
          />
          <NumberInput
            label="Гарантия, месяцев"
            min={0}
            max={120}
            placeholder="0 — без гарантии продавца"
            value={values.warrantyMonths}
            onChange={(value) => set("warrantyMonths", value)}
          />
        </SimpleGrid>
        <TextInput
          label="Изготовитель или импортёр и адрес"
          placeholder="ООО «Ромашка», г. Москва, ул. …"
          value={values.manufacturerInfo}
          onChange={(event) => set("manufacturerInfo", event.currentTarget.value)}
        />
        {rules.shelfLife && (
          <TextInput
            label="Срок годности"
            placeholder="5 лет с даты производства"
            value={values.shelfLife}
            onChange={(event) => set("shelfLife", event.currentTarget.value)}
          />
        )}

        <Box>
          <Text size="sm" fw={600} mb={6}>Подтверждение соответствия</Text>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <Select
              label="Документ"
              required={needsDocument}
              data={CONFORMITY_TYPES.filter((item) => !(needsDocument && item.value === "NOT_REQUIRED")).map((item) => ({ value: item.value, label: item.label }))}
              placeholder={needsDocument ? "Обязателен для этой группы" : "Не указан"}
              value={values.conformityType || null}
              onChange={(value) => onChange({ ...values, conformityType: value ?? "", conformityRegulation: values.conformityRegulation || rules.conformity?.regulation || "" })}
              error={errors.conformityType}
            />
            {values.conformityType && values.conformityType !== "NOT_REQUIRED" && (
              <TextInput
                label="Номер в реестре"
                placeholder="ЕАЭС RU С-CN.АБ12.В.00001/26"
                required
                value={values.conformityNumber}
                onChange={(event) => set("conformityNumber", event.currentTarget.value)}
                error={errors.conformityNumber}
              />
            )}
          </SimpleGrid>
          {values.conformityType && values.conformityType !== "NOT_REQUIRED" && (
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm" mt="sm">
              <TextInput label="Действует до" type="date" value={values.conformityValidUntil} onChange={(event) => set("conformityValidUntil", event.currentTarget.value)} />
              <TextInput
                label="Ссылка на запись в реестре ФСА"
                placeholder="https://pub.fsa.gov.ru/…"
                value={values.conformityUrl}
                onChange={(event) => set("conformityUrl", event.currentTarget.value.trim())}
                description={<>Найдите документ по номеру на <Anchor href={CONFORMITY_REGISTRY_URL} target="_blank" rel="noreferrer" size="xs">pub.fsa.gov.ru</Anchor> — со ссылкой бумажную копию при доставке можно не прикладывать</>}
              />
            </SimpleGrid>
          )}
          {rules.conformity && !isNew && (
            <Text size="xs" c="dimmed" mt={6}>Для б/у позиции документ не обязателен, но укажите состояние и недостатки в описании.</Text>
          )}
        </Box>

        <Textarea
          label="Правила безопасного использования"
          placeholder="Например: беречь от детей, не допускать попадания в глаза"
          autosize
          minRows={1}
          maxRows={5}
          value={values.safetyInfo}
          onChange={(event) => set("safetyInfo", event.currentTarget.value)}
        />
        {rules.note && <Alert color="yellow" variant="light">{rules.note}</Alert>}
      </Stack>
    </Box>
  )
}
