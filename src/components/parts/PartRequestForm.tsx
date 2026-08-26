"use client"

import { useState } from "react"
import { Alert, Button, Group, Select, Stack, Text, TextInput, Textarea } from "@mantine/core"
import { IconCheck, IconSearch } from "@tabler/icons-react"
import { PART_TYPES } from "@/lib/constants"

/**
 * Заявка «ищу деталь».
 *
 * В разделе запчастей пока нет позиций, и обычный поиск человеку ничего
 * не даст. Форма переворачивает порядок: покупатель описывает деталь, а
 * магазины отвечают предложениями.
 *
 * Полей намеренно мало. Каждое лишнее поле — это часть людей, которые
 * закроют форму: требовать VIN и год от человека, знающего только «нужен
 * насос на Камри», значит потерять заявку.
 */

type Props = {
  /** Категория, из которой пришёл человек: подставляется в комментарий. */
  presetCategory?: string | null
  onSuccess?: () => void
}

export default function PartRequestForm({ presetCategory = null, onSuccess }: Props) {
  const [partName, setPartName] = useState("")
  const [oemNumber, setOemNumber] = useState("")
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [year, setYear] = useState("")
  const [condition, setCondition] = useState<string | null>("ANY")
  const [comment, setComment] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const categoryLabel = presetCategory
    ? PART_TYPES.find((type) => type.value === presetCategory)?.label
    : null

  const submit = async () => {
    setSending(true)
    setError(null)
    setFieldErrors({})

    try {
      const response = await fetch("/api/parts/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partName: partName || null,
          oemNumber: oemNumber || null,
          make: make || null,
          model: model || null,
          year: year || null,
          condition,
          comment: [categoryLabel ? `Категория: ${categoryLabel}` : null, comment]
            .filter(Boolean).join(". ") || null,
          name,
          phone,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.error || "Не удалось отправить заявку")
        setFieldErrors(data.details || {})
        return
      }

      setSent(true)
      onSuccess?.()
    } catch {
      setError("Нет связи с площадкой. Проверьте подключение и попробуйте снова.")
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <Alert
        color="teal"
        variant="light"
        radius="md"
        icon={<IconCheck size={18} />}
        title="Заявка принята"
      >
        <Text size="sm">
          Магазины запчастей увидят её и свяжутся с вами по телефону. Обычно первые
          предложения приходят в течение дня.
        </Text>
      </Alert>
    )
  }

  return (
    <Stack gap="sm">
      {error && <Alert color="red" variant="light" radius="md">{error}</Alert>}

      <TextInput
        label="Какая деталь нужна"
        placeholder="Насос ГУР, передние колодки, фара левая"
        value={partName}
        onChange={(event) => setPartName(event.currentTarget.value)}
        error={fieldErrors.partName?.[0]}
        size="sm"
      />

      <TextInput
        label="Номер детали"
        description="Если знаете. По номеру продавец найдёт деталь точнее"
        placeholder="44310-06090"
        value={oemNumber}
        onChange={(event) => setOemNumber(event.currentTarget.value)}
        error={fieldErrors.oemNumber?.[0]}
        size="sm"
      />

      <Group grow gap="sm">
        <TextInput
          label="Марка"
          placeholder="Toyota"
          value={make}
          onChange={(event) => setMake(event.currentTarget.value)}
          size="sm"
        />
        <TextInput
          label="Модель"
          placeholder="Camry"
          value={model}
          onChange={(event) => setModel(event.currentTarget.value)}
          size="sm"
        />
        <TextInput
          label="Год"
          placeholder="2015"
          value={year}
          onChange={(event) => setYear(event.currentTarget.value)}
          error={fieldErrors.year?.[0]}
          size="sm"
        />
      </Group>

      <Select
        label="Состояние"
        data={[
          { value: "ANY", label: "Любое" },
          { value: "NEW", label: "Только новая" },
          { value: "USED", label: "Можно б/у" },
        ]}
        value={condition}
        onChange={setCondition}
        size="sm"
        allowDeselect={false}
      />

      <Textarea
        label="Что уточнить продавцу"
        placeholder="Сроки, объём двигателя, комплектация"
        value={comment}
        onChange={(event) => setComment(event.currentTarget.value)}
        error={fieldErrors.comment?.[0]}
        autosize
        minRows={2}
        maxRows={4}
        size="sm"
      />

      <Group grow gap="sm">
        <TextInput
          label="Как к вам обращаться"
          placeholder="Иван"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          error={fieldErrors.name?.[0]}
          required
          size="sm"
        />
        <TextInput
          label="Телефон"
          description="По нему ответят продавцы"
          placeholder="+7 900 000-00-00"
          value={phone}
          onChange={(event) => setPhone(event.currentTarget.value)}
          error={fieldErrors.phone?.[0]}
          required
          size="sm"
        />
      </Group>

      <Button
        onClick={submit}
        loading={sending}
        disabled={!name.trim() || !phone.trim() || (!partName.trim() && !oemNumber.trim())}
        leftSection={<IconSearch size={16} />}
        color="indigo"
        radius="md"
        size="md"
      >
        Отправить заявку
      </Button>

      <Text size="xs" c="dimmed">
        Заявка бесплатна. Регистрация не нужна.
      </Text>
    </Stack>
  )
}
