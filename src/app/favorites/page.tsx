"use client"
export const dynamic = "force-dynamic"
import { Container, Stack, Title, Text, Center, Button, ThemeIcon } from "@mantine/core"
import { IconHeart } from "@tabler/icons-react"
import Link from "next/link"

export default function Page() {
  return (
    <Container size="md" py="xl">
      <Stack gap="md" align="center">
        <ThemeIcon variant="light" color="indigo" size={48} radius="md"><IconHeart size={24} /></ThemeIcon>
        <Title order={2} ff="var(--font-display),sans-serif">Раздел</Title>
        <Text size="sm" c="#71717a">Войдите для доступа</Text>
        <Button component={Link} href="/auth/signin" variant="light" color="indigo" size="sm" radius="md">Войти</Button>
      </Stack>
    </Container>
  )
}
