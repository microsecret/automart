import type { Metadata } from "next"
import { Suspense } from "react"
import { Container } from "@mantine/core"
import HomeCatalog from "@/components/catalog/HomeCatalog"
import ForumHighlights from "@/components/forum/ForumHighlights"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default function RootPage() {
  return (
    <>
      <HomeCatalog />
      {/* Блок форума идёт после каталога: человек пришёл за машинами, и
          обсуждения — это то, что удерживает его, когда подходящего лота
          не нашлось. Suspense не даёт запросу к форуму задержать первый
          экран. */}
      <Container size="xl" pb="xl">
        <Suspense fallback={null}>
          <ForumHighlights />
        </Suspense>
      </Container>
    </>
  )
}
