"use client"
export const dynamic = "force-dynamic"

import { Container, Card, Stack, Title, Text, Box } from "@mantine/core"
import { IconCar } from "@tabler/icons-react"
import SignUpForm from "@/components/auth/SignUpForm"

export default function SignUpPage() {
  return (
    <Container size={420} py={48}>
      <Stack gap="xl" align="center" mb="xl">
        <Box
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconCar size={28} color="white" />
        </Box>
        <Stack gap={4} align="center">
          <Title order={1} size="h2">Регистрация</Title>
          <Text size="sm" c="gray.5">Создайте аккаунт на Авторынке</Text>
        </Stack>
      </Stack>

      <Card withBorder radius="lg" p="xl" shadow="sm">
        <SignUpForm />
      </Card>
    </Container>
  )
}
