"use client"

import { useState } from "react"
import styles from "./catalogs.module.css"

export type SchematicUnit = {
  partType: string
  label: string
  count: number
  spot: { x: number; y: number }
}

/**
 * Схема автомобиля с узлами — своя, нарисованная для площадки, а не схема
 * производителя. Точка узла и строка списка подсвечивают друг друга: на
 * телефоне наведения нет, поэтому список рядом всегда, а точка — ссылка
 * к тому же разделу страницы.
 */
export default function CarSchematic({ units, title }: { units: SchematicUnit[]; title: string }) {
  const [active, setActive] = useState<string | null>(null)

  return (
    <div className={styles.schematic}>
      <svg viewBox="0 0 800 340" role="img" aria-label={`Схема узлов: ${title}`} className={styles.schematicSvg}>
        <defs>
          <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--catalog-car-top)" />
            <stop offset="1" stopColor="var(--catalog-car-bottom)" />
          </linearGradient>
        </defs>
        <line x1="20" y1="298" x2="780" y2="298" className={styles.ground} />
        <path
          className={styles.carBody}
          fill="url(#carBody)"
          d="M58 252 L58 206 Q60 184 92 175 L206 152 Q236 146 262 124 L326 82 Q348 68 382 66 L516 66 Q560 68 590 96 L638 140 Q702 150 736 166 Q752 176 752 204 L752 252 Q752 262 740 262 L664 262 A54 54 0 0 0 558 262 L240 262 A54 54 0 0 0 134 262 L70 262 Q58 262 58 252 Z"
        />
        <path className={styles.carGlass} d="M300 128 L344 90 Q358 80 382 80 L452 80 L452 128 Z" />
        <path className={styles.carGlass} d="M468 80 L516 80 Q548 82 572 104 L598 128 L468 128 Z" />
        <line x1="460" y1="80" x2="460" y2="252" className={styles.carLine} />
        <line x1="300" y1="140" x2="300" y2="252" className={styles.carLine} />
        <path className={styles.carLine} d="M92 175 L206 160" />
        <rect x="70" y="196" width="22" height="30" rx="5" className={styles.carDetail} />
        <rect x="726" y="182" width="18" height="24" rx="4" className={styles.carTail} />
        {[187, 611].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="262" r="46" className={styles.tyre} />
            <circle cx={cx} cy="262" r="26" className={styles.rim} />
            <circle cx={cx} cy="262" r="6" className={styles.hub} />
          </g>
        ))}
        {units.map((unit) => {
          const isActive = active === unit.partType
          return (
            <a
              key={unit.partType}
              href={`#unit-${unit.partType}`}
              aria-label={`${unit.label}${unit.count ? `: ${unit.count} предложений` : ""}`}
              className={`${styles.spot} ${isActive ? styles.spotActive : ""} ${unit.count ? styles.spotHasOffers : ""}`}
              onMouseEnter={() => setActive(unit.partType)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(unit.partType)}
              onBlur={() => setActive(null)}
            >
              <circle cx={unit.spot.x} cy={unit.spot.y} r="17" className={styles.spotHalo} />
              <circle cx={unit.spot.x} cy={unit.spot.y} r="9" className={styles.spotDot} />
              {isActive && (
                <g className={styles.spotTip}>
                  <rect x={unit.spot.x - 70} y={unit.spot.y - 52} width="140" height="30" rx="8" />
                  <text x={unit.spot.x} y={unit.spot.y - 32} textAnchor="middle">{unit.label}</text>
                </g>
              )}
            </a>
          )
        })}
      </svg>

      <ul className={styles.unitLegend}>
        {units.map((unit) => (
          <li key={unit.partType}>
            <a
              href={`#unit-${unit.partType}`}
              className={`${styles.legendItem} ${active === unit.partType ? styles.legendActive : ""}`}
              onMouseEnter={() => setActive(unit.partType)}
              onMouseLeave={() => setActive(null)}
            >
              <span className={styles.legendDot} aria-hidden="true" />
              <span>{unit.label}</span>
              <span className={styles.legendCount}>{unit.count || "—"}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
