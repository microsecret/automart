type LeWheelMarkProps = {
  size?: number
  /** Уникальный суффикс для id градиентов: на странице знак встречается дважды. */
  idSuffix?: string
}

/**
 * Знак LeWheel — крылатое колесо.
 *
 * Повторяет фирменный логотип с баннера бота: спицованный диск и три пера
 * крыла, уходящие влево. Вектор вместо прежнего PNG — чёткий на любом
 * масштабе и умеет двигаться.
 *
 * Объём набран средствами плоской графики: диагональный градиент по ободу
 * даёт металлический блик, тёмный зазор под ним читается как глубина, спицы
 * светлеют к ступице. Вращается только диск — крыло и блик стоят на месте,
 * иначе знак выглядел бы кувыркающейся наклейкой, а не катящимся колесом.
 */
export default function LeWheelMark({ size = 38, idSuffix = "" }: LeWheelMarkProps) {
  const tyre = `tyre${idSuffix}`
  const spokeFill = `spoke${idSuffix}`
  const wing = `wing${idSuffix}`
  const hub = `hub${idSuffix}`
  const gloss = `gloss${idSuffix}`

  // Десять спиц, как на фирменном диске.
  const spokes = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324]

  return (
    <svg
      className="lewheel-mark"
      width={size * 1.12}
      height={size}
      viewBox="0 0 72 64"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={tyre} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="45%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#131033" />
        </linearGradient>
        <linearGradient id={spokeFill} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#c7d2fe" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id={wing} x1="0%" y1="0%" x2="100%" y2="60%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#4338ca" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        <radialGradient id={hub} cx="34%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#4338ca" />
        </radialGradient>
        <linearGradient id={gloss} x1="0%" y1="0%" x2="55%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Крыло: три пера, сужающиеся влево. Стоит за колесом и не вращается —
          оно обозначает скорость, а не является частью диска. */}
      <g className="lewheel-mark__wing">
        <path d="M31 21 C22 19.5 13 20.5 6 24 C13.5 23.4 21 23.8 28 25.4 Z" fill={`url(#${wing})`} />
        <path d="M29 30 C21 29.2 13.5 30 8 32.4 C14 32 20.5 32.3 26.5 33.4 Z" fill={`url(#${wing})`} opacity="0.88" />
        <path d="M31 38.6 C24 38.4 17.5 39.2 12.6 41 C18 40.8 23.6 41.1 28.4 42 Z" fill={`url(#${wing})`} opacity="0.72" />
      </g>

      {/* Покрышка и тёмный зазор под ней — от них отсчитывается объём. */}
      <circle cx="42" cy="32" r="24" fill={`url(#${tyre})`} />
      <circle cx="42" cy="32" r="19.5" fill="#0b1020" />

      {/* Вращающийся диск. */}
      <g className="lewheel-mark__spin">
        {spokes.map((angle) => (
          <g key={angle} transform={`rotate(${angle} 42 32)`}>
            {/* Спица расширяется к ободу — так она читается как объёмная лопасть. */}
            <path
              d="M42 14.6 C44.6 19.2 45.6 23.4 45.2 27.6 L38.8 27.6 C38.4 23.4 39.4 19.2 42 14.6 Z"
              fill={`url(#${spokeFill})`}
            />
          </g>
        ))}
        <circle cx="42" cy="32" r="18" fill="none" stroke="#e0e7ff" strokeWidth="1.6" opacity="0.9" />
      </g>

      {/* Ступица поверх спиц — центр вращения остаётся неподвижным. */}
      <circle cx="42" cy="32" r="6.4" fill={`url(#${hub})`} />
      <circle cx="42" cy="32" r="6.4" fill="none" stroke="#1e1b4b" strokeOpacity="0.5" strokeWidth="1" />
      <circle cx="40" cy="29.8" r="1.9" fill="#ffffff" opacity="0.6" />

      {/* Блик по верхней кромке: не вращается, иначе пропадёт ощущение
          постоянного источника света. */}
      <path
        className="lewheel-mark__gloss"
        d="M42 8 A24 24 0 0 1 64.8 24.6 A19.5 19.5 0 0 0 42 12.5 Z"
        fill={`url(#${gloss})`}
      />
    </svg>
  )
}
