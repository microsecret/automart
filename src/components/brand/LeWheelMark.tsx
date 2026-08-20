type LeWheelMarkProps = {
  size?: number
  /** Уникальный суффикс для id градиентов: на странице знак встречается дважды. */
  idSuffix?: string
}

/**
 * Знак LeWheel — крылатое колесо.
 *
 * Повторяет фирменный знак с баннера: тёмно-синий диск со светлыми спицами и
 * три клиновидных пера слева. Перья толще у колеса и сходят на нет к краю,
 * верхнее длиннее нижних — так читается движение.
 *
 * Знак статичный. Анимацию убрали намеренно: логотип виден на каждой странице,
 * и постоянное движение в углу экрана отвлекает от содержимого.
 */
export default function LeWheelMark({ size = 38, idSuffix = "" }: LeWheelMarkProps) {
  const tyre = `tyre${idSuffix}`
  const spoke = `spoke${idSuffix}`
  const wing = `wing${idSuffix}`
  const hub = `hub${idSuffix}`

  return (
    <svg
      className="lewheel-mark"
      width={size * 1.62}
      height={size}
      viewBox="-28 0 104 64"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={tyre} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#3b3596" />
          <stop offset="45%" stopColor="#211d63" />
          <stop offset="100%" stopColor="#0f0d33" />
        </linearGradient>
        <linearGradient id={spoke} x1="18%" y1="0%" x2="82%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor="#e2e6ff" />
          <stop offset="100%" stopColor="#b9c0f0" />
        </linearGradient>
        <linearGradient id={wing} x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#2f2a86" />
          <stop offset="55%" stopColor="#282270" />
          <stop offset="100%" stopColor="#211d63" />
        </linearGradient>
        <radialGradient id={hub} cx="36%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#dfe3ff" />
          <stop offset="100%" stopColor="#a9b2e8" />
        </radialGradient>
      </defs>

      {/* Крыло: три клина слева. Каждый толстый у колеса и заострён к краю;
          верхний уходит дальше всех, нижний самый короткий. */}
      <path d="M31 11.4 C22 9.6 6 10 -26 15.8 C4 15.6 20 17.4 31 20.8 Z" fill={`url(#${wing})`} />
      <path d="M29 25 C21 24 7 24.4 -20 28.6 C4 28.4 19 29.6 29 31.6 Z" fill={`url(#${wing})`} />
      <path d="M28 37.2 C21 36.8 10 37.4 -12 40.6 C7 40.4 20 41 28 42.4 Z" fill={`url(#${wing})`} />

      {/* Покрышка и глубокий зазор под ней. */}
      <circle cx="40" cy="32" r="23" fill={`url(#${tyre})`} />
      <circle cx="40" cy="32" r="18.4" fill="#0d0b2c" />

      {/* Диск: десять спиц, расширяющихся к ободу. */}
      <g>
        {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((angle) => (
          <path
            key={angle}
            d="M40 16.4 C42.4 20.6 43.3 24.2 43 27.6 L37 27.6 C36.7 24.2 37.6 20.6 40 16.4 Z"
            fill={`url(#${spoke})`}
            transform={`rotate(${angle} 40 32)`}
          />
        ))}
        <circle cx="40" cy="32" r="17.2" fill="none" stroke="#eef0ff" strokeWidth="1.5" />
      </g>

      {/* Ступица. */}
      <circle cx="40" cy="32" r="5.6" fill={`url(#${hub})`} />
      <circle cx="40" cy="32" r="5.6" fill="none" stroke="#211d63" strokeOpacity="0.45" strokeWidth="0.9" />
    </svg>
  )
}
