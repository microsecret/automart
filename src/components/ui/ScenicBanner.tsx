import Image from "next/image"
import type { ReactNode } from "react"

export type ScenicScene = "buy" | "sell" | "auctions" | "parts" | "fuel" | "garage" | "deliveries" | "subscriptions" | "payments" | "referral"

/** Decorative scenery only; controls and account data stay real accessible HTML. */
export default function ScenicBanner({ scene, children, className = "" }: {
  scene: ScenicScene
  children: ReactNode
  className?: string
}) {
  return (
    <section data-scene={scene} className={`lw-scenic-banner ${className}`.trim()}>
      <Image src={`/images/ui/scenic-v1/${scene}-1600.webp`} alt="" aria-hidden="true" fill sizes="(max-width: 600px) 100vw, 1200px" unoptimized className="lw-scenic-banner__image" />
      <div className="lw-scenic-banner__content">{children}</div>
    </section>
  )
}
