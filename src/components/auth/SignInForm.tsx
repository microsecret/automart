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
import { IconAlertCircle, IconAt, IconLock } from "@tabler/icons-react"

export default function SignInForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    initialValues: { email: "", password: "" },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Введите корректный email"),
      password: (v) => (v.length < 6 ? "Минимум 6 символов" : null),
    },
  })

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      })
      if (res?.error) {
        setError("Неверный email или пароль")
      } else if (res?.ok) {
        window.location.href = "/dashboard"
      }
    } catch {
      setError("Ошибка входа. Попробуйте позже.")
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
            label="Email"
            placeholder="you@example.com"
            leftSection={<IconAt size={18} />}
            size="md"
            radius="md"
            {...form.getInputProps("email")}
          />
          <PasswordInput
            label="Пароль"
            placeholder="Ваш пароль"
            leftSection={<IconLock size={18} />}
            size="md"
            radius="md"
            {...form.getInputProps("password")}
          />
          <Button type="submit" loading={loading} fullWidth size="md" radius="md" color="indigo">
            Войти
          </Button>
        </Stack>
      </form>

      <Divider label="или" labelPosition="center" />

      <Group justify="center">
        <Text size="sm" c="gray.5">
          Нет аккаунта?{" "}
          <Anchor href="/auth/signup" size="sm" c="indigo" fw={500}>
            Зарегистрироваться
          </Anchor>
        </Text>
      </Group>
    </Stack>
  )
}
