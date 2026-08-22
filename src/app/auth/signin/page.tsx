"use client"
export const dynamic = "force-dynamic"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Container, Card, Stack, Text, Box, Group, ThemeIcon } from "@mantine/core"
import { IconCar, IconShieldCheck, IconChartBar, IconBell } from "@tabler/icons-react"
import SignInForm from "@/components/auth/SignInForm"
import { signInReason } from "@/lib/signin-reason"

const FEATURES = [
  { icon: IconShieldCheck, text: "Сопровождение сделки и проверка документов" },
  { icon: IconChartBar, text: "Продвижение объявлений" },
  { icon: IconBell, text: "Уведомления и сообщения" },
]

function SignInContent() {
  /* Страница входа молчала о том, зачем человек здесь.

     Кнопки «Показать телефон», «Написать продавцу», подача объявления,
     избранное и заявка на лот — все уводят сюда, и все получали один и
     тот же текст: «Вход в аккаунт. Почта или телефон и ваш пароль».
     Шапки и подвала на этой странице нет, вернуться можно только кнопкой
     браузера — получался тупик без объяснения.

     Причину знает адрес возврата. Для подачи объявления здесь же сказано
     главное, чего не было нигде, кроме страницы в подвале: размещение
     бесплатное. */
  const reason = signInReason(useSearchParams().get("callbackUrl"))

  return (
    <Container className="auth-experience" size="md" py={48}>
      <Group className="auth-experience__layout" gap={48} align="center" wrap="nowrap" justify="center">
        {/* Левая колонка — преимущества (десктоп) */}
        <Stack className="auth-experience__context" gap="lg" visibleFrom="md" maw={300}>
          <Group gap="sm">
            <Box className="auth-experience__brand-mark">
              <IconCar size={24} color="white" />
            </Box>
            <Text fw={800} fz={24} c="var(--market-ink)" ff="var(--font-display),sans-serif">LeWheel</Text>
          </Group>
          <Text size="sm" c="gray.5" lh={1.6}>Маркетплейс транспорта и запчастей с проверкой истории и безопасными сделками.</Text>
          <Stack gap="sm">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <Group key={f.text} gap="sm">
                  <ThemeIcon variant="light" color="indigo" size={32} radius="md"><Icon size={18} /></ThemeIcon>
                  <Text size="sm" c="gray.6">{f.text}</Text>
                </Group>
              )
            })}
          </Stack>
        </Stack>

        {/* Правая колонка — форма */}
        <Stack className="auth-experience__form-area" gap="lg" align="center" w="100%" maw={420} style={{ minWidth: 0, flexShrink: 0 }}>
          <Stack gap={4} align="center">
            <Text component="h1" fw={800} fz={24} c="var(--market-ink)" ff="var(--font-display),sans-serif" ta="center">{reason.title}</Text>
            <Text size="sm" c="gray.5" ta="center" maw={380}>{reason.hint}</Text>
          </Stack>

          <Card className="auth-experience__form-card" withBorder radius="md" p={{ base: "lg", sm: "xl" }} w="100%" maw={420} shadow="sm">
            <SignInForm />
          </Card>
        </Stack>
      </Group>
    </Container>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  )
}
