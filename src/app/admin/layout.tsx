"use client"
export const dynamic = "force-dynamic"

import { useSession } from "next-auth/react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Box, Container, Text, Center, Loader } from "@mantine/core"
import AdminWorkspaceNavigation from "@/components/admin/AdminWorkspaceNavigation"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
      return
    }
    if (session.user.role !== "ADMIN") {
      router.push("/")
    }
  }, [session, status, router])

  if (status === "loading") {
    return (
      <Center h={400}>
        <Loader color="indigo" />
      </Center>
    )
  }

  if (!session || session.user.role !== "ADMIN") {
    return (
      <Container py={40}>
        <Center>
          <Text c="dimmed">Доступ только для администраторов</Text>
        </Center>
      </Container>
    )
  }

  return (
    <>
      {/* Поля те же, что у рабочей области под навигацией: без них полоса
          разделов стояла на шестнадцать пикселей левее карточек ниже, и
          левый край админки шёл ступенькой. */}
      <Box px={{ base: "sm", md: "md" }} pt={{ base: "sm", md: "md" }} mb={{ base: -8, md: -12 }}>
        <AdminWorkspaceNavigation />
      </Box>
      {children}
    </>
  )
}
