"use client"

import { useState } from "react"
import { useForm } from "@mantine/form"
import { signIn } from "next-auth/react"
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
import { IconAlertCircle, IconAt, IconLock, IconUser } from "@tabler/icons-react"

export default function SignUpForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    initialValues: { name: "", email: "", password: "", confirmPassword: "" },
    validate: {
      name: (v) => (v.trim().length < 2 ? "Минимум 2 символа" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Введите корректный email"),
      password: (v) => (v.length < 6 ? "Минимум 6 символов" : null),
      confirmPassword: (v, values) => (v !== values.password ? "Пароли не совпадают" : null),
    },
  })

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Ошибка регистрации")
        return
      }
      // Авто-вход после регистрации
      const signInRes = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      })
      if (signInRes?.ok) {
        window.location.href = "/dashboard"
      } else {
        setError("Аккаунт создан. Войдите вручную.")
      }
    } catch {
      setError("Ошибка регистрации. Попробуйте позже.")
    } finally {
      setLoading(false)
    }
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
        <Text size="sm" c="#71717a">
          Уже есть аккаунт?{" "}
          <Anchor href="/auth/signin" size="sm" c="indigo" fw={500}>
            Войти
          </Anchor>
        </Text>
      </Group>
    </Stack>
  )
}
