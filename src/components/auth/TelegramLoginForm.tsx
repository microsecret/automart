"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Alert, Anchor, Button, Group, Stack, Text, TextInput } from "@mantine/core"
import { IconBrandTelegram, IconLock, IconPhone, IconRefresh } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

type TelegramCodeResponse = { message?: string; retryAfter?: number }

function getSafeCallbackUrl(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}

export default function TelegramLoginForm() {
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [callbackUrl, setCallbackUrl] = useState("/dashboard")
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  useEffect(() => {
    setCallbackUrl(getSafeCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl")))
  }, [])

  const requestCode = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const data = await fetchJson<TelegramCodeResponse>("/api/auth/telegram/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      setSent(true)
      setInfo(data.message || "Проверьте Telegram-бота")
    } catch (requestError) {
      setError(getApiClientErrorMessage(requestError, "Сервис временно недоступен"))
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await signIn("phone-otp", { phone, code, redirect: false, callbackUrl })
      if (result?.ok) {
        window.location.assign(callbackUrl)
      } else {
        setError("Код неверный или устарел")
      }
    } catch {
      setError("Не удалось выполнить вход")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack gap="md">
      {error && <Alert color="red">{error}</Alert>}
      {info && <Alert color="indigo">{info}</Alert>}
      <TextInput label="Номер телефона" placeholder="+7 900 000-00-00" leftSection={<IconPhone size={17} />} value={phone} onChange={(event) => setPhone(event.currentTarget.value)} disabled={sent} />
      {!sent ? (
        <Button onClick={requestCode} loading={loading} color="indigo" leftSection={<IconBrandTelegram size={18} />}>Получить код в Telegram</Button>
      ) : (
        <>
          <Text size="sm" c="dimmed">Откройте чат с ботом и введите пятизначный код из сообщения.</Text>
          <TextInput label="Код из Telegram" placeholder="00000" leftSection={<IconLock size={17} />} value={code} onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" maxLength={5} />
          <Button onClick={verifyCode} loading={loading} disabled={code.length !== 5} color="indigo">Войти</Button>
          <Group justify="space-between">
            <Button variant="subtle" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => { setSent(false); setCode(""); setInfo(null) }}>Изменить номер</Button>
            {botUsername && <Anchor href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" size="sm">Открыть @{botUsername}</Anchor>}
          </Group>
        </>
      )}
      <Text size="xs" c="dimmed">Если вы ещё не регистрировались, сначала нажмите «Старт» в боте и отправьте свой контакт. После подтверждения номера можно входить по пятизначному коду; он действует 10 минут.</Text>
      <Button component={Link} href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} variant="subtle" color="gray">Вернуться к входу по паролю</Button>
      {!botUsername && <Text size="xs" c="dimmed">Ссылка на бота появится здесь после подключения канала.</Text>}
    </Stack>
  )
}
