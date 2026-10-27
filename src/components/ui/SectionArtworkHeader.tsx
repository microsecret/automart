import Image from "next/image"
import type { ReactNode } from "react"
import styles from "./section-artwork-header.module.css"

export type SectionScene = "parts" | "auctions" | "forum" | "legal-documents" | "valuation" | "help" | "sell"

/** Artwork is decorative; headings, counters and actions remain real HTML. */
export default function SectionArtworkHeader({ scene, title, children }: {
  scene: SectionScene
  title: ReactNode
  children?: ReactNode
}) {
  return <header className={styles.header} data-section-scene={scene}>
    <Image src={`/images/ui/scenic-v1/${scene}-1600.webp`} alt="" aria-hidden="true" fill unoptimized sizes="(max-width: 600px) 100vw, 1000px" className={styles.image} />
    <div className={styles.content}><h1>{title}</h1>{children}</div>
  </header>
}
