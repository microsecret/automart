import Image from "next/image"

type LeWheelBrandProps = {
  size?: number
  tone?: "default" | "inverse"
  showName?: boolean
  priority?: boolean
  className?: string
}

export default function LeWheelBrand({
  size = 38,
  tone = "default",
  showName = true,
  priority = false,
  className = "",
}: LeWheelBrandProps) {
  return (
    <span
      className={`lewheel-brand lewheel-brand--${tone}${className ? ` ${className}` : ""}`}
      aria-label={showName ? "LeWheel" : undefined}
    >
      <span className="lewheel-brand__mark" style={{ width: size, height: size }} aria-hidden="true">
        <Image
          src="/brand/lewheel-mark.png"
          alt=""
          width={size}
          height={size}
          priority={priority}
          sizes={`${size}px`}
        />
      </span>
      {showName && (
        <span className="lewheel-brand__wordmark">
          <span>Le</span><strong>Wheel</strong>
        </span>
      )}
    </span>
  )
}
