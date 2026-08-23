"use client"

import { useMemo, useState } from "react"
import { Alert, Button, Divider, Grid, Group, NumberInput, Paper, SegmentedControl, Stack, Text, TextInput, Textarea, ThemeIcon } from "@mantine/core"
import { IconDownload, IconFileCheck, IconInfoCircle, IconLock } from "@tabler/icons-react"

type DocumentKind = "sale" | "acceptance"

type FormState = {
  city: string
  date: string
  sellerName: string
  sellerPassport: string
  sellerAddress: string
  buyerName: string
  buyerPassport: string
  buyerAddress: string
  makeModel: string
  year: string
  vin: string
  plate: string
  pts: string
  sts: string
  price: string
  mileage: string
  keys: string
  condition: string
  payment: string
}

const INITIAL_FORM: FormState = {
  city: "",
  date: new Date().toISOString().slice(0, 10),
  sellerName: "",
  sellerPassport: "",
  sellerAddress: "",
  buyerName: "",
  buyerPassport: "",
  buyerAddress: "",
  makeModel: "",
  year: "",
  vin: "",
  plate: "",
  pts: "",
  sts: "",
  price: "",
  mileage: "",
  keys: "2",
  condition: "Видимые недостатки перечислены сторонами до подписания документа.",
  payment: "Расчёт производится при подписании договора и передаче автомобиля.",
}

function formatDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [year, month, day] = value.split("-")
  return `${day}.${month}.${year}`
}

function rtfEscape(value: string) {
  let result = ""
  for (const character of value.replace(/\r\n?/g, "\n")) {
    if (character === "\\" || character === "{" || character === "}") result += `\\${character}`
    else if (character === "\n") result += "\\line "
    else {
      const code = character.charCodeAt(0)
      result += code > 127 ? `\\u${code > 32767 ? code - 65536 : code}?` : character
    }
  }
  return result
}

function rtfDocument(title: string, paragraphs: string[]) {
  const body = paragraphs.map((paragraph) => `${rtfEscape(paragraph)}\\par`).join("\n")
  return `{\\rtf1\\ansi\\ansicpg1251\\deff0{\\fonttbl{\\f0 Arial;}}\\viewkind4\\uc1\\paperw11906\\paperh16838\\margl1134\\margr1134\\margt1134\\margb1134\\f0\\fs22\n\\qc\\b\\fs28 ${rtfEscape(title)}\\b0\\fs22\\par\\pard\n${body}}`
}

function signatureBlock(role: string, name: string) {
  return `${role}: __________________ / ${name || "________________________"} /`
}

export default function LegalDocumentBuilder() {
  const [kind, setKind] = useState<DocumentKind>("sale")
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)
  const requiredReady = useMemo(() => Boolean(form.city.trim() && form.date && form.sellerName.trim() && form.buyerName.trim() && form.makeModel.trim() && form.vin.trim() && form.price.trim()), [form])

  const update = (field: keyof FormState, value: string | number) => setForm((current) => ({ ...current, [field]: String(value) }))

  const download = () => {
    if (!requiredReady) {
      setError("Заполните город, дату, ФИО сторон, автомобиль, VIN и цену.")
      return
    }
    setError(null)

    const vehicle = `${form.makeModel}, ${form.year || "год не указан"}, VIN ${form.vin.toUpperCase()}, госномер ${form.plate || "не указан"}, ПТС/ЭПТС ${form.pts || "не указан"}, СТС ${form.sts || "не указан"}`
    const parties = [
      `г. ${form.city}                                                                 ${formatDate(form.date)}`,
      `Продавец: ${form.sellerName}, паспорт: ${form.sellerPassport || "не указан"}, адрес: ${form.sellerAddress || "не указан"}.`,
      `Покупатель: ${form.buyerName}, паспорт: ${form.buyerPassport || "не указан"}, адрес: ${form.buyerAddress || "не указан"}.`,
    ]

    const isSale = kind === "sale"
    const title = isSale ? "ДОГОВОР КУПЛИ-ПРОДАЖИ ТРАНСПОРТНОГО СРЕДСТВА" : "АКТ ПРИЁМА-ПЕРЕДАЧИ ТРАНСПОРТНОГО СРЕДСТВА"
    const paragraphs = isSale
      ? [
          ...parties,
          `1. Продавец передаёт в собственность Покупателя, а Покупатель принимает и оплачивает транспортное средство: ${vehicle}.`,
          `2. Цена транспортного средства составляет ${form.price} рублей. ${form.payment}`,
          "3. Продавец подтверждает, что транспортное средство принадлежит ему на законном основании и, по сообщённым им сведениям, не находится в залоге, под арестом или запретом на регистрационные действия.",
          `4. Состояние и известные сторонам особенности: ${form.condition || "не указаны"}`,
          "5. Автомобиль, документы и ключи передаются по акту приёма-передачи. Стороны сверили VIN и сведения в документах до подписания.",
          "6. Договор составлен в трёх экземплярах, имеющих одинаковую силу: для Продавца, Покупателя и регистрационных действий.",
          signatureBlock("Продавец", form.sellerName),
          signatureBlock("Покупатель", form.buyerName),
        ]
      : [
          ...parties,
          `Настоящий акт составлен к договору купли-продажи от ${formatDate(form.date)}. Продавец передал, а Покупатель принял: ${vehicle}.`,
          `Пробег на момент передачи: ${form.mileage || "не указан"} км. Передано ключей: ${form.keys || "не указано"}.`,
          `Переданные документы: ПТС/ЭПТС ${form.pts || "не указан"}; СТС ${form.sts || "не указан"}.`,
          `Комплектация, состояние и замечания: ${form.condition || "не указаны"}`,
          `Порядок расчёта: ${form.payment}`,
          "Стороны сверили идентификационные номера и подтверждают фактическую передачу указанного автомобиля, ключей и документов.",
          signatureBlock("Передал — Продавец", form.sellerName),
          signatureBlock("Принял — Покупатель", form.buyerName),
        ]

    const blob = new Blob([rtfDocument(title, paragraphs)], { type: "application/rtf;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = isSale ? "dogovor-kupli-prodazhi-avtomobilya.rtf" : "akt-priema-peredachi-avtomobilya.rtf"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <Paper id="document-builder" withBorder radius="xl" p={{ base: "md", md: "xl" }}>
      <Stack gap="lg">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <ThemeIcon size={42} radius="md" color="indigo" variant="light"><IconFileCheck size={21} /></ThemeIcon>
          <Stack gap={2}>
            <Text component="h2" fw={800} fz={{ base: 22, md: 27 }}>Заполнить и скачать</Text>
            <Text size="sm" c="dimmed">Файл RTF открывается в Word, LibreOffice и большинстве мобильных редакторов.</Text>
          </Stack>
        </Group>

        <Alert color="teal" variant="light" icon={<IconLock size={18} />}>
          Данные формируются только в вашем браузере: паспорт, адрес и VIN не отправляются на сервер и не сохраняются LeWheel.
        </Alert>

        <SegmentedControl fullWidth value={kind} onChange={(value) => setKind(value as DocumentKind)} data={[{ value: "sale", label: "Договор купли-продажи" }, { value: "acceptance", label: "Акт приёма-передачи" }]} />

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}><TextInput required label="Город подписания" placeholder="Москва" value={form.city} onChange={(event) => update("city", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}><TextInput required type="date" label="Дата" value={form.date} onChange={(event) => update("date", event.currentTarget.value)} /></Grid.Col>
        </Grid>

        <Divider label="Продавец" labelPosition="left" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput required label="ФИО продавца" value={form.sellerName} onChange={(event) => update("sellerName", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput label="Паспорт: серия, номер, кем и когда выдан" value={form.sellerPassport} onChange={(event) => update("sellerPassport", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={12}><TextInput label="Адрес регистрации продавца" value={form.sellerAddress} onChange={(event) => update("sellerAddress", event.currentTarget.value)} /></Grid.Col>
        </Grid>

        <Divider label="Покупатель" labelPosition="left" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput required label="ФИО покупателя" value={form.buyerName} onChange={(event) => update("buyerName", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput label="Паспорт: серия, номер, кем и когда выдан" value={form.buyerPassport} onChange={(event) => update("buyerPassport", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={12}><TextInput label="Адрес регистрации покупателя" value={form.buyerAddress} onChange={(event) => update("buyerAddress", event.currentTarget.value)} /></Grid.Col>
        </Grid>

        <Divider label="Автомобиль и расчёт" labelPosition="left" />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 8 }}><TextInput required label="Марка и модель" placeholder="Toyota Camry" value={form.makeModel} onChange={(event) => update("makeModel", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}><NumberInput label="Год выпуска" min={1900} max={new Date().getFullYear() + 1} value={form.year ? Number(form.year) : ""} onChange={(value) => update("year", value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput required label="VIN или номер рамы" maxLength={32} value={form.vin} onChange={(event) => update("vin", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput label="Государственный номер" value={form.plate} onChange={(event) => update("plate", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput label="ПТС или ЭПТС" value={form.pts} onChange={(event) => update("pts", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput label="СТС" value={form.sts} onChange={(event) => update("sts", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><NumberInput required label="Цена, ₽" min={0} thousandSeparator=" " value={form.price ? Number(form.price) : ""} onChange={(value) => update("price", value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}><NumberInput label="Пробег, км" min={0} thousandSeparator=" " value={form.mileage ? Number(form.mileage) : ""} onChange={(value) => update("mileage", value)} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}><NumberInput label="Количество ключей" min={0} max={20} value={Number(form.keys)} onChange={(value) => update("keys", value)} /></Grid.Col>
          <Grid.Col span={12}><Textarea label="Состояние, комплектация и известные недостатки" minRows={3} value={form.condition} onChange={(event) => update("condition", event.currentTarget.value)} /></Grid.Col>
          <Grid.Col span={12}><Textarea label="Порядок расчёта" minRows={2} value={form.payment} onChange={(event) => update("payment", event.currentTarget.value)} /></Grid.Col>
        </Grid>

        {error && <Alert color="red" icon={<IconInfoCircle size={18} />}>{error}</Alert>}
        <Button size="md" radius="md" color="indigo" leftSection={<IconDownload size={18} />} onClick={download}>Скачать {kind === "sale" ? "договор" : "акт"} в RTF</Button>
        <Text size="xs" c="dimmed">Перед подписанием сверьте сведения с оригиналами документов. Шаблон не учитывает доверенность, долевую собственность, наследство, юридическое лицо и иные особые обстоятельства — для них нужна индивидуальная проверка.</Text>
      </Stack>
    </Paper>
  )
}
