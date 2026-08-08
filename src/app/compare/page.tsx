"use client"
export const dynamic = "force-dynamic"
import { Container, Stack, Title, Text, Center, Button, ThemeIcon } from "@mantine/core"
import { IconGitCompare } from "@tabler/icons-react"
import Link from "next/link"

export default function ComparePage() {
  return (
    <Container size="md" py="xl">
      <Stack gap="md" align="center">
        <ThemeIcon variant="light" color="indigo" size={48} radius="md"><IconGitCompare size={24} /></ThemeIcon>
        <Title order={2} ff="var(--font-display),sans-serif">Сравнение объявлений</Title>
        <Text size="sm" c="#71717a" ta="center" maw={400}>Выберите объявления для сравнения. Добавляйте их со страницы объявления или из каталога.</Text>
        <Button component={Link} href="/" variant="light" color="indigo" size="sm" radius="md">К объявлениям</Button>
      </Stack>
    </Container>
  )
}
