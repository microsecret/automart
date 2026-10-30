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
  const source = `/images/ui/titanium-v1/${kind}`
  return (
    // Native width candidates let the browser select by density without an image relay.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${source}-${size > 160 ? 640 : 320}.webp`}
      srcSet={`${source}-96.webp 96w, ${source}-320.webp 320w, ${source}-640.webp 640w`}
      sizes={`${size}px`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`lw-service-artwork ${className}`.trim()}
    />
  )
}
