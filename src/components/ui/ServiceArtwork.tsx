import Image from "next/image"

export type ServiceArtworkKind =
  | "auctions" | "fuel-map" | "garage" | "partner" | "history-check"
  | "publish-listing" | "valuation" | "matching" | "safe-deal" | "documents" | "parts"
  | "deliveries" | "messages" | "favorites"

/** Decorative artwork. Labels and actions remain accessible HTML in the caller. */
export default function ServiceArtwork({ kind, size = 96, className = "" }: {
  kind: ServiceArtworkKind
  size?: number
  className?: string
}) {
  return (
    <Image
      src={`/images/ui/titanium-v1/${kind}-${size > 160 ? 640 : 320}.webp`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`lw-service-artwork ${className}`.trim()}
    />
  )
}
