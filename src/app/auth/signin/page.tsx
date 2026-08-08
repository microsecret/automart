"use client"
export const dynamic = "force-dynamic"

import { Container, Card, Stack, Title, Text, Box } from "@mantine/core"
import { IconCar } from "@tabler/icons-react"
import SignInForm from "@/components/auth/SignInForm"

export default function SignInPage() {
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
          <Title order={1} size="h2">Вход в Авторынок</Title>
          <Text size="sm" c="gray.5">Войдите в свой аккаунт</Text>
        </Stack>
      </Stack>

      <Card withBorder radius="lg" p="xl" shadow="sm">
        <SignInForm />
      </Card>
    </Container>
  )
}
