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
      width={size * 1.3}
      height={size}
      viewBox="-6 0 84 64"
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

      {/* Крыло: сплошная изогнутая форма, охватывающая колесо сверху и
          загибающаяся вниз слева, плюс три линии-шлейфа под ней. Именно так
          устроен фирменный знак — не набор отдельных перьев сбоку, а единое
          крыло с подчёркиванием.

          Крыло не вращается: оно обозначает движение вперёд, а не часть
          диска. Линии живут своим ритмом и создают ощущение потока. */}
      <g className="lewheel-mark__wing">
        {/* Основное перо: от правого верха над колесом, широкой дугой влево
            и вниз, с острым загибом на конце. */}
        <path
          className="lewheel-mark__blade"
          d="M44 9.5 C30 5.6 15 7.4 1 15.6 C-2.4 17.6 -3 20.4 0.6 21.6 C4.4 22.8 9 21.4 13.6 20.2 C22 18 31 17.4 39.4 19.6 C41.6 20.2 43 19 43.4 17 C43.9 14.4 44.2 11.8 44 9.5 Z"
          fill={`url(#${wing})`}
        />
        {/* Три линии-шлейфа: подчёркивают крыло и уходят влево. */}
        <path className="lewheel-mark__feather lewheel-mark__feather--1" d="M34 24.5 C24 22.8 13 23.6 3 26.6 C11.5 25.4 21 25.4 30.5 26.8 C32.6 27.1 33.7 26.2 34 24.5 Z" fill={`url(#${wing})`} opacity="0.9" />
        <path className="lewheel-mark__feather lewheel-mark__feather--2" d="M30 33 C20.5 32.4 10.5 33.6 2 36.4 C10.5 35.2 19.5 35 27.5 35.6 C29.3 35.8 30 34.8 30 33 Z" fill={`url(#${wing})`} opacity="0.72" />
        <path className="lewheel-mark__feather lewheel-mark__feather--3" d="M31 41.4 C23 41.8 14.5 43.2 7.5 45.4 C15 44.4 22.5 44.2 28.8 44.4 C30.4 44.5 31 43.4 31 41.4 Z" fill={`url(#${wing})`} opacity="0.55" />
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
