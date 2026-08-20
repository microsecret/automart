import LeWheelMark from "./LeWheelMark"

type LeWheelBrandProps = {
  size?: number
  tone?: "default" | "inverse"
  showName?: boolean
  /** Оставлен для совместимости с вызовами: вектору предзагрузка не нужна. */
  priority?: boolean
  className?: string
  /** Знак встречается на странице дважды — id градиентов не должны совпадать. */
  idSuffix?: string
}

export default function LeWheelBrand({
  size = 38,
  tone = "default",
  showName = true,
  className = "",
  idSuffix = "",
}: LeWheelBrandProps) {
  return (
    <span
      className={`lewheel-brand lewheel-brand--${tone}${className ? ` ${className}` : ""}`}
      aria-label={showName ? "LeWheel" : undefined}
    >
      {/* Знак шире, чем высок: крыло уходит влево за пределы колеса. Ширина
          задаётся с запасом, иначе перья сжались бы в полоску. */}
      <span className="lewheel-brand__mark" style={{ width: size * 1.34, height: size }} aria-hidden="true">
        <LeWheelMark size={size} idSuffix={idSuffix || tone} />
      </span>
      {showName && (
        <span className="lewheel-brand__wordmark">
          <span>Le</span><strong>Wheel</strong>
        </span>
      )}
    </span>
  )
}
