"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Box, Container } from "@mantine/core"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

const RECOVERY_DESTINATIONS = [
  { matches: (pathname: string) => pathname.startsWith("/parts"), href: "/parts-finder", label: "К запчастям" },
  { matches: (pathname: string) => pathname.startsWith("/auctions"), href: "/auctions", label: "К аукционам" },
  { matches: (pathname: string) => pathname.startsWith("/news"), href: "/news", label: "К новостям" },
  { matches: (pathname: string) => pathname.startsWith("/services"), href: "/services", label: "К сервисам" },
  { matches: (pathname: string) => pathname.startsWith("/category") || pathname.startsWith("/listings"), href: "/", label: "К объявлениям" },
] as const

function getRecoveryDestination(pathname: string) {
  return RECOVERY_DESTINATIONS.find((destination) => destination.matches(pathname))
    ?? { href: "/", label: "На главную" }
}

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname()
  const recovery = getRecoveryDestination(pathname)

  useEffect(() => {
    console.error("Application route error", error)
  }, [error])

  return (
    <Container size="sm" py={{ base: 64, md: 112 }}>
      <Box>
        <AsyncErrorState
          title="Страница временно недоступна"
          description="Мы уже получили информацию об ошибке. Попробуйте открыть страницу ещё раз — ваши данные не потеряны."
          onRetry={reset}
          backHref={recovery.href}
          backLabel={recovery.label}
        />
      </Box>
    </Container>
  )
}
