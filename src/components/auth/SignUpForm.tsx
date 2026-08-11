"use client"

import { useEffect, useState } from "react"
import { useForm } from "@mantine/form"
import Link from "next/link"
import {
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Alert,
  Anchor,
  Divider,
  Group,
} from "@mantine/core"
import { IconAlertCircle, IconAt, IconLock, IconPhone, IconUser } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

type RegistrationResponse = { emailDeliveryPending?: boolean }

function getSafeCallbackUrl(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}

export default function SignUpForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [emailDeliveryPending, setEmailDeliveryPending] = useState(false)
  const [callbackUrl, setCallbackUrl] = useState("/dashboard")

  useEffect(() => {
    setCallbackUrl(getSafeCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl")))
  }, [])

  const form = useForm({
    initialValues: { name: "", email: "", phone: "", password: "", confirmPassword: "" },
    validate: {
      name: (v) => (v.trim().length < 2 ? "Минимум 2 символа" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Введите корректный email"),
      phone: (v) => (v.replace(/\D/g, "").length >= 10 ? null : "Введите номер телефона"),
      password: (v) => (v.length < 6 ? "Минимум 6 символов" : null),
      confirmPassword: (v, values) => (v !== values.password ? "Пароли не совпадают" : null),
    },
  })

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJson<RegistrationResponse>("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone,
          password: values.password,
        }),
      })
      setEmailDeliveryPending(Boolean(data.emailDeliveryPending))
      setSubmittedEmail(values.email.trim())
    } catch (requestError) {
      setError(getApiClientErrorMessage(requestError, "Ошибка регистрации. Попробуйте позже."))
    } finally {
      setLoading(false)
    }
  }

  if (submittedEmail) {
    return (
      <Stack gap="md" align="center" ta="center">
        <Alert color={emailDeliveryPending ? "yellow" : "green"} variant="light" radius="md" w="100%">
          {emailDeliveryPending
            ? <>Аккаунт создан. Подтвердите номер через Telegram, а письмо на <b>{submittedEmail}</b> отправим, когда почтовый канал будет доступен.</>
            : <>Письмо с подтверждением отправлено на <b>{submittedEmail}</b>.</>}
        </Alert>
        <Text size="sm" c="gray.6">
          {emailDeliveryPending
            ? "Откройте бот Авторынка, отправьте свой контакт, затем вернитесь сюда и получите одноразовый код для входа. Пароль до подтверждения email не используется."
            : "Перейдите по ссылке из письма, затем подтвердите номер через Telegram-бота для входа по коду."}
        </Text>
        <Button component={Link} href={`/auth/telegram?callbackUrl=${encodeURIComponent(callbackUrl)}`} fullWidth color="indigo">Продолжить через Telegram</Button>
        <Anchor component={Link} href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} size="sm" c="indigo">Войти по email после подтверждения</Anchor>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" radius="md">
          {error}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Имя"
            placeholder="Как вас зовут"
            leftSection={<IconUser size={18} />}
            size="md"
            radius="md"
            {...form.getInputProps("name")}
          />
          <TextInput
            label="Email"
            placeholder="you@example.com"
            leftSection={<IconAt size={18} />}
            size="md"
            radius="md"
            {...form.getInputProps("email")}
          />
          <TextInput
            label="Телефон"
            placeholder="+7 900 000-00-00"
            description="Нужен для входа по коду в Telegram и защиты аккаунта"
            leftSection={<IconPhone size={18} />}
            inputMode="tel"
            size="md"
            radius="md"
            {...form.getInputProps("phone")}
          />
          <PasswordInput
            label="Пароль"
            placeholder="Минимум 6 символов"
            leftSection={<IconLock size={18} />}
            size="md"
            radius="md"
            {...form.getInputProps("password")}
          />
          <PasswordInput
            label="Повторите пароль"
            placeholder="Подтвердите пароль"
            leftSection={<IconLock size={18} />}
            size="md"
            radius="md"
            {...form.getInputProps("confirmPassword")}
          />
          <Button type="submit" loading={loading} fullWidth size="md" radius="md" color="indigo">
            Создать аккаунт
          </Button>
        </Stack>
      </form>

      <Divider label="или" labelPosition="center" />

      <Group justify="center">
        <Text size="sm" c="gray.5">
          Уже есть аккаунт?{" "}
          <Anchor component={Link} href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} size="sm" c="indigo" fw={500}>
            Войти
          </Anchor>
        </Text>
      </Group>
    </Stack>
  )
}
