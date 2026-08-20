type LeWheelMarkProps = {
  size?: number
  /** Уникальный суффикс для id градиентов: на странице знак встречается дважды. */
  idSuffix?: string
}

/**
 * Знак LeWheel — колесо.
 *
 * Раньше это был PNG: он мылился на плотных экранах и не мог двигаться.
 * Вектор чёткий на любом масштабе и весит меньше картинки.
 *
 * Объём набран средствами плоской графики: диагональный градиент по ободу
 * даёт металлический блик, тёмное кольцо под ним читается как глубина, а
 * спицы светлеют к центру. Вращается только группа спиц — обод и блик стоят
 * на месте, поэтому колесо выглядит крутящимся, а не «едущей наклейкой».
 */
export default function LeWheelMark({ size = 38, idSuffix = "" }: LeWheelMarkProps) {
  const rim = `rim${idSuffix}`
  const disc = `disc${idSuffix}`
  const gloss = `gloss${idSuffix}`
  const hub = `hub${idSuffix}`

  // Пять спиц: нечётное число не даёт рисунку выглядеть зеркальным крестом.
  const spokes = [0, 72, 144, 216, 288]

  return (
    <svg
      className="lewheel-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={rim} x1="12%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor="#c7d2fe" />
          <stop offset="38%" stopColor="#6366f1" />
          <stop offset="72%" stopColor="#3730a3" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        <radialGradient id={disc} cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="70%" stopColor="#0b1220" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <linearGradient id={gloss} x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={hub} cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#eef2ff" />
          <stop offset="60%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4338ca" />
        </radialGradient>
      </defs>

      {/* Покрышка: внешнее кольцо, самое тёмное — от него отсчитывается объём. */}
      <circle cx="32" cy="32" r="30" fill={`url(#${rim})`} />
      <circle cx="32" cy="32" r="26" fill={`url(#${disc})`} />

      {/* Вращающаяся часть: спицы и обод диска. */}
      <g className="lewheel-mark__spin">
        <circle cx="32" cy="32" r="23" fill="none" stroke="#312e81" strokeWidth="1.5" opacity="0.75" />
        {spokes.map((angle) => (
          <g key={angle} transform={`rotate(${angle} 32 32)`}>
            {/* Спица сужается к ободу — так она читается как объёмная лопасть. */}
            <path
              d="M32 13.5 C36.2 20 37.4 25 36.4 30.2 L27.6 30.2 C26.6 25 27.8 20 32 13.5 Z"
              fill={`url(#${rim})`}
              opacity="0.96"
            />
            <path d="M32 14.6 C34.6 19.4 35.6 23.6 35.2 28" fill="none" stroke="#e0e7ff" strokeOpacity="0.5" strokeWidth="1.1" strokeLinecap="round" />
          </g>
        ))}
      </g>

      {/* Ступица поверх спиц — центр вращения остаётся неподвижным. */}
      <circle cx="32" cy="32" r="8.6" fill={`url(#${hub})`} />
      <circle cx="32" cy="32" r="8.6" fill="none" stroke="#1e1b4b" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx="29.4" cy="29.2" r="2.6" fill="#ffffff" opacity="0.55" />

      {/* Блик по верхней кромке: не вращается, иначе исчезнет ощущение источника света. */}
      <path
        className="lewheel-mark__gloss"
        d="M32 2 A30 30 0 0 1 60.5 22.5 A26 26 0 0 0 32 6 Z"
        fill={`url(#${gloss})`}
      />
    </svg>
  )
}
