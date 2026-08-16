import type { Metadata } from "next"
import HomeCatalog from "@/components/catalog/HomeCatalog"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default function RootPage() {
  return <HomeCatalog />
}
