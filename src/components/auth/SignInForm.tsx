"use client"

import { useEffect, useState } from "react"
import { useForm } from "@mantine/form"
import Link from "next/link"
import { signIn } from "next-auth/react"
import {
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Alert,
  Anchor,
  Group,
  Divider,
} from "@mantine/core"
import { IconAlertCircle, IconAt, IconLock, IconBrandTelegram } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

type ResendVerificationResponse = { message?: string }

function getSafeCallbackUrl(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}

export default function SignInForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false)
  const [verificationState, setVerificationState] = useState<string | null>(null)
  const [callbackUrl, setCallbackUrl] = useState("/dashboard")
  /* Пришёл из чата: пароля у него, скорее всего, нет вовсе — признак
     несут ссылки от объявления до формы входа. */
  const [fromTelegram, setFromTelegram] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setVerificationState(params.get("verified"))
    setCallbackUrl(getSafeCallbackUrl(params.get("callbackUrl")))
    setFromTelegram(params.get("from") === "telegram")
  }, [])

  const form = useForm({
    initialValues: { identifier: "", password: "" },
    validate: {
      identifier: (value) => {
        const normalized = value.trim()
        if (/^\S+@\S+\.\S+$/.test(normalized)) return null
        return normalized.replace(/\D/g, "").length >= 10 ? null : "Введите корректную почту или телефон"
      },
      password: (v) => (v.length < 8 ? "Минимум 8 символов" : null),
    },
  })

  const handleSubmit = async (values: { identifier: string; password: string }) => {
    setLoading(true)
    setError(null)
    setInfo(null)
    setNeedsEmailVerification(false)
    try {
      const res = await signIn("credentials", {
        identifier: values.identifier,
        password: values.password,
        redirect: false,
        callbackUrl,
      })
      if (res?.error === "EMAIL_NOT_VERIFIED") {
        const enteredEmail = values.identifier.includes("@")
        setNeedsEmailVerification(enteredEmail)
        setError(enteredEmail
          ? "Сначала подтвердите почту по ссылке из письма."
          : "Почта не подтверждена. Повторите вход, указав почту, и запросите новое письмо.")
      } else if (res?.error === "RATE_LIMITED") {
        setError("Слишком много попыток входа. Подождите 15 минут и попробуйте снова.")
      } else if (res?.error === "ACCOUNT_BANNED") {
        setError("Аккаунт заблокирован администратором. Обратитесь в поддержку, если считаете это ошибкой.")
      } else if (res?.error === "ACCOUNT_RESTRICTED") {
        setError("Доступ к аккаунту временно ограничен. Уточните причину у поддержки.")
      } else if (res?.error) {
        setError("Неверный email или пароль")
      } else if (res?.ok) {
        window.location.assign(callbackUrl)
      }
    } catch {
      setError("Ошибка входа. Попробуйте позже.")
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const data = await fetchJson<ResendVerificationResponse>("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.values.identifier }),
      })
      setInfo(data.message || "Письмо с подтверждением отправлено.")
    } catch (requestError) {
      setError(getApiClientErrorMessage(requestError, "Не удалось отправить письмо"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack gap="md">
      {verificationState === "1" && <Alert color="green" variant="light" radius="md">Email подтверждён. Теперь можно войти.</Alert>}
      {verificationState === "0" && <Alert color="red" variant="light" radius="md">Ссылка недействительна или устарела. Запросите новое письмо.</Alert>}
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" radius="md">
          {error}
        </Alert>
      )}
      {info && <Alert color="green" variant="light" radius="md">{info}</Alert>}
      {needsEmailVerification && <Button variant="light" color="indigo" onClick={resendVerification} loading={loading}>Отправить письмо повторно</Button>}

      {/* Telegram первым, пароль вторым.

          Девяносто девять человек из ста двадцати пришли через Telegram, а
          страница встречала их полем пароля, которого у них нет: ссылка на
          бота была мелким текстом под формой. За сутки восемьдесят шесть
          человек открыли форму подачи объявления и создали одно. */}
      <Stack gap="xs">
        <Button
          component={Link}
          href={`/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          fullWidth
          size="md"
          radius="md"
          color="indigo"
          leftSection={<IconBrandTelegram size={18} />}
        >
          Войти через Telegram
        </Button>
        <Text size="xs" c="gray.5" ta="center">
          {fromTelegram
            /* Он пришёл из группы по кнопке: у него уже есть Telegram, и
               сказать надо не «зарегистрируйтесь», а «вам сюда». */
            ? "Вы пришли из чата — вход в один шаг, пароль не нужен"
            : "Регистрация проходит в боте — за минуту, без анкеты"}
        </Text>
      </Stack>

      <Divider label="или по паролю" labelPosition="center" />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Почта или телефон"
            placeholder="you@example.com или +7 900 000-00-00"
            leftSection={<IconAt size={18} />}
            autoComplete="username"
            inputMode="text"
            size="md"
            radius="md"
            {...form.getInputProps("identifier")}
          />
          <PasswordInput
            label="Пароль"
            placeholder="Ваш пароль"
            leftSection={<IconLock size={18} />}
            autoComplete="current-password"
            size="md"
            radius="md"
            {...form.getInputProps("password")}
          />
          <Button type="submit" loading={loading} fullWidth size="md" radius="md" color="indigo">
            Войти
          </Button>
        </Stack>
      <Text size="xs" c="gray.5" ta="right"><Link href="/auth/forgot-password" style={{ color: "var(--market-primary)" }}>Забыли пароль?</Link></Text>
    </form>

      {/* Прежняя ссылка внизу убрана: то же предложение теперь стоит
          наверху кнопкой, и повторять его дважды незачем. */}
    </Stack>
  )
}
