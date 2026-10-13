"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Alert, Box, Button, Chip, Group, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Textarea,
} from "@mantine/core"
import { IconAlertTriangle, IconArrowRight, IconBuildingStore, IconLogin } from "@tabler/icons-react"

/* Отделы будущего каталога (план 002, этап 2). Пока это подсказка
   администратору, что везёт продавец, — и самому продавцу, что площадка
   принимает не только запчасти. */
const DEPARTMENTS = ["Запчасти", "Масла и жидкости", "Автохимия", "Аксессуары", "Шины и диски", "Инструменты"]

const FORMS = [
  { value: "ENTREPRENEUR", label: "ИП" },
  { value: "COMPANY", label: "ООО / АО" },
  { value: "SELF_EMPLOYED", label: "Самозанятый" },
]

type Fields = "storeName" | "legalName" | "inn" | "ogrn" | "legalAddress" | "city" | "phone" | "email" | "sellerForm"

/**
 * Анкета продавца: магазин-черновик и проверка реквизитов одним шагом.
 * После отправки продавец сразу попадает в кабинет и грузит прайс —
 * проверка идёт параллельно, а не перед началом работы.
 */
export default function SellerOnboardingForm({ onCreated, compact = false }: { onCreated?: () => void; compact?: boolean }) {
  const router = useRouter()
  const { status } = useSession()
  const [form, setForm] = useState({
    storeName: "", sellerForm: "ENTREPRENEUR", legalName: "", inn: "", ogrn: "", legalAddress: "", city: "", phone: "", email: "", description: "",
  })
  const [departments, setDepartments] = useState<string[]>(["Запчасти"])
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Fields, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [key]: event.currentTarget.value }))
    if (fieldErrors[key as Fields]) setFieldErrors((current) => ({ ...current, [key]: undefined }))
  }

  if (status === "unauthenticated") {
    return (
      <Stack gap="sm" align="flex-start">
        <Text size="sm" c="dimmed">
          Магазин привязывается к аккаунту: туда приходят заказы и заявки покупателей. Войдите через
          Telegram или почту — анкета займёт пару минут.
        </Text>
        <Group gap="xs">
          <Button component={Link} href="/auth/signin?callbackUrl=%2Fsell%23form" color="indigo" leftSection={<IconLogin size={16} />}>
            Войти и открыть магазин
          </Button>
          <Button component={Link} href="/auth/signup?callbackUrl=%2Fsell%23form" variant="default">
            Регистрация
          </Button>
        </Group>
      </Stack>
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/stores/onboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, sells: departments.join(", ") }),
      })
      const payload = await response.json().catch(() => null)
      if (response.status === 409 && payload?.storeId) {
        router.push("/dashboard/store")
        return
      }
      if (!response.ok) {
        setFieldErrors(payload?.fieldErrors || {})
        setError(typeof payload?.error === "string" ? payload.error : "Не удалось отправить анкету")
        return
      }
      if (onCreated) onCreated()
      else router.push("/dashboard/store?welcome=1")
    } catch {
      setError("Связь прервалась. Проверьте интернет и отправьте ещё раз.")
    } finally {
      setIsSaving(false)
    }
  }

  const innHint = form.sellerForm === "COMPANY" ? "10 цифр" : "12 цифр"

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: compact ? 1 : 2 }} spacing="sm">
          <TextInput
            required label="Название магазина" placeholder="АвтоДеталь" autoComplete="organization"
            description="Видят покупатели, из него же адрес витрины"
            value={form.storeName} onChange={set("storeName")} error={fieldErrors.storeName}
          />
          <TextInput
            required label="Город" placeholder="Уфа" autoComplete="address-level2"
            description="Откуда отправляете заказы"
            value={form.city} onChange={set("city")} error={fieldErrors.city}
          />
        </SimpleGrid>

        <Box>
          <Text size="sm" fw={500} mb={6}>Форма бизнеса</Text>
          <SegmentedControl
            fullWidth data={FORMS} value={form.sellerForm} color="indigo"
            onChange={(value) => { setForm((current) => ({ ...current, sellerForm: value })); setFieldErrors((current) => ({ ...current, inn: undefined })) }}
          />
        </Box>

        <SimpleGrid cols={{ base: 1, sm: compact ? 1 : 2 }} spacing="sm">
          <TextInput
            required
            label={form.sellerForm === "COMPANY" ? "Название юрлица" : form.sellerForm === "ENTREPRENEUR" ? "ИП (ФИО)" : "ФИО"}
            placeholder={form.sellerForm === "COMPANY" ? "ООО «АвтоДеталь»" : "Иванов Иван Иванович"}
            value={form.legalName} onChange={set("legalName")} error={fieldErrors.legalName}
          />
          <TextInput
            required label="ИНН" placeholder={innHint} inputMode="numeric" maxLength={12}
            description="Сверим по ФНС до публикации витрины"
            value={form.inn} onChange={set("inn")} error={fieldErrors.inn}
          />
          {form.sellerForm !== "SELF_EMPLOYED" && (
            <TextInput
              label={form.sellerForm === "COMPANY" ? "ОГРН" : "ОГРНИП"} placeholder={form.sellerForm === "COMPANY" ? "13 цифр" : "15 цифр"} inputMode="numeric"
              description="Можно позже, но до публикации — обязательно"
              value={form.ogrn} onChange={set("ogrn")} error={fieldErrors.ogrn}
            />
          )}
          <TextInput
            label="Юридический адрес" placeholder="г. Уфа, ул. ..."
            description="Покупатель видит его по закону"
            value={form.legalAddress} onChange={set("legalAddress")} error={fieldErrors.legalAddress}
          />
          <TextInput
            required label="Телефон" placeholder="+7 900 000-00-00" type="tel" inputMode="tel" autoComplete="tel"
            value={form.phone} onChange={set("phone")} error={fieldErrors.phone}
          />
          <TextInput
            label="Почта" placeholder="shop@example.ru" type="email" inputMode="email" autoComplete="email"
            value={form.email} onChange={set("email")} error={fieldErrors.email}
          />
        </SimpleGrid>

        <Box>
          <Text size="sm" fw={500} mb={6}>Что продаёте</Text>
          <Chip.Group multiple value={departments} onChange={setDepartments}>
            <Group gap={6}>
              {DEPARTMENTS.map((item) => <Chip key={item} value={item} size="sm" color="indigo" variant="outline">{item}</Chip>)}
            </Group>
          </Chip.Group>
        </Box>

        <Textarea
          label="Пара слов о магазине" placeholder="Какие марки, оригинал или аналоги, сроки, возврат"
          autosize minRows={2} maxLength={1000}
          value={form.description} onChange={set("description")}
        />

        {error && <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>{error}</Alert>}

        <Group justify="space-between" align="center" gap="sm" wrap="wrap">
          <Text size="xs" c="dimmed" maw={420}>
            Каталог можно наполнять сразу после анкеты. Витрина откроется покупателям, когда мы сверим
            реквизиты и вы отправите магазин на публикацию.
          </Text>
          <Button type="submit" color="indigo" size="md" loading={isSaving} leftSection={<IconBuildingStore size={17} />} rightSection={<IconArrowRight size={16} />}>
            Открыть магазин
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
