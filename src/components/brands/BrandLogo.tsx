/**
 * SVG-логотипы брендов авто — стилизованные значки.
 * Упрощённые фирменные знаки (не точные копии) для использования в UI.
 * Каждый логотип — монохромный, цвет наследуется (currentColor).
 */

interface BrandLogoProps {
  brand: string
  size?: number
  color?: string
}

export default function BrandLogo({ brand, size = 24, color = "currentColor" }: BrandLogoProps) {
  const key = normalizeBrand(brand)
  const path = LOGOS[key]
  if (!path) return null

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={brand}
    >
      {path(color)}
    </svg>
  )
}

function normalizeBrand(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/\(ваз\)/g, "")
    .replace(/[\s\-]/g, "")
    .trim()
}

type LogoFn = (color: string) => React.ReactNode
const LOGOS: Record<string, LogoFn> = {
  // LADA — стилизованная ладья
  lada: (c) => (
    <path
      d="M24 6 L40 38 H30 L24 26 L18 38 H8 Z M24 14 L34 34 H28 L24 28 L20 34 H14 Z"
      fill={c}
    />
  ),

  // Toyota — три эллипса (стилизация)
  toyota: (c) => (
    <>
      <ellipse cx="24" cy="24" rx="20" ry="12" stroke={c} strokeWidth="2.5" fill="none" />
      <ellipse cx="24" cy="24" rx="6" ry="14" stroke={c} strokeWidth="2.5" fill="none" transform="rotate(0 24 24)" />
      <ellipse cx="24" cy="16" rx="4" ry="7" stroke={c} strokeWidth="2.5" fill="none" />
    </>
  ),

  // BMW — круг с секторами (стилизация)
  bmw: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2.5" fill="none" />
      <circle cx="24" cy="24" r="13" fill={c} />
      <path d="M24 11 A13 13 0 0 1 37 24 L24 24 Z" fill="#fff" />
      <path d="M24 37 A13 13 0 0 1 11 24 L24 24 Z" fill="#fff" />
      <text x="24" y="6" fontSize="7" fontWeight="700" fill={c} textAnchor="middle">BMW</text>
    </>
  ),

  // Mercedes — трёхлучевая звезда
  mercedesbenz: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2.5" fill="none" />
      <path d="M24 6 L24 24 M24 24 L40 36 M24 24 L8 36" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3" fill={c} />
    </>
  ),

  // Audi — четыре кольца
  audi: (c) => (
    <>
      {[8, 16, 24, 32].map((x) => (
        <circle key={x} cx={x + 4} cy="24" r="8" stroke={c} strokeWidth="2.2" fill="none" />
      ))}
    </>
  ),

  // Volkswagen — VW монограмма
  volkswagen: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2.5" fill="none" />
      <path d="M14 18 L22 34 L24 28 L26 34 L34 18" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  // Kia — стилизованная надпись
  kia: (c) => (
    <text x="24" y="30" fontSize="14" fontWeight="900" fill={c} textAnchor="middle" fontFamily="sans-serif">KIA</text>
  ),

  // Hyundai — стилизованная H в эллипсе
  hyundai: (c) => (
    <>
      <ellipse cx="24" cy="24" rx="20" ry="14" stroke={c} strokeWidth="2.5" fill="none" />
      <text x="24" y="30" fontSize="14" fontWeight="900" fill={c} textAnchor="middle">H</text>
    </>
  ),

  // Nissan — горизонтальная полоса с надписью
  nissan: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2.5" fill="none" />
      <rect x="6" y="20" width="36" height="8" fill={c} />
      <text x="24" y="27" fontSize="6" fontWeight="700" fill="#fff" textAnchor="middle">NISSAN</text>
    </>
  ),

  // Honda — стилизованная H с рамкой
  honda: (c) => (
    <text x="24" y="32" fontSize="22" fontWeight="900" fill={c} textAnchor="middle" fontFamily="sans-serif">H</text>
  ),

  // Mazda — стилизованная M в виде крыльев
  mazda: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2" fill="none" />
      <path d="M16 34 L20 14 L24 22 L28 14 L32 34" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  // Porsche — герб (стилизация)
  porsche: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2.5" fill="none" />
      <path d="M16 14 H32 V18 H28 V22 H32 V26 H28 V30 H32 V34 H16 V30 H20 V26 H16 V22 H20 V18 H16 Z" fill={c} />
    </>
  ),

  // Lexus — стилизованная L в круге
  lexus: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2" fill="none" />
      <path d="M18 12 V34 H32" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),

  // Renault — ромб
  renault: (c) => (
    <path d="M24 4 L40 24 L24 44 L8 24 Z M24 12 L34 24 L24 36 L14 24 Z" fill={c} />
  ),

  // Skoda — крыло со стрелой (стилизация)
  skoda: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2.5" fill="none" />
      <path d="M16 30 Q24 10 36 22 L30 28 Q24 22 20 30 Z" fill={c} />
    </>
  ),

  // Ford — овал с надписью
  ford: (c) => (
    <>
      <ellipse cx="24" cy="24" rx="22" ry="12" stroke={c} strokeWidth="2.5" fill="none" />
      <text x="24" y="28" fontSize="9" fontWeight="700" fill={c} textAnchor="middle">Ford</text>
    </>
  ),

  // Chevrolet — галочка-крест
  chevrolet: (c) => (
    <path d="M18 6 H30 L32 14 H26 V20 H38 L36 28 H26 V42 H22 V28 H12 L10 20 H22 V14 H16 Z" fill={c} />
  ),

  // Opel — молния в круге
  opel: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2.5" fill="none" />
      <path d="M28 8 L14 24 L22 24 L20 40 L34 24 L26 24 Z" fill={c} />
    </>
  ),

  // ===== КИТАЙСКИЕ =====

  // Geely — стилизованный щит
  geely: (c) => (
    <>
      <path d="M24 4 L40 12 V26 Q40 38 24 44 Q8 38 8 26 V12 Z" fill="none" stroke={c} strokeWidth="2.5" />
      <text x="24" y="29" fontSize="8" fontWeight="700" fill={c} textAnchor="middle">GEELY</text>
    </>
  ),

  // Chery — стилизованная буква A (звезда)
  chery: (c) => (
    <>
      <ellipse cx="24" cy="24" rx="20" ry="20" stroke={c} strokeWidth="2.5" fill="none" />
      <path d="M24 10 L28 22 H40 L30 30 L34 42 L24 34 L14 42 L18 30 L8 22 H20 Z" fill={c} />
    </>
  ),

  // Haval — стилизованная надпись
  haval: (c) => (
    <text x="24" y="30" fontSize="10" fontWeight="900" fill={c} textAnchor="middle" fontFamily="sans-serif">HAVAL</text>
  ),

  // Changan — V-образный знак
  changan: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2.5" fill="none" />
      <path d="M10 16 L24 38 L38 16" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M16 16 L24 28 L32 16" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),

  // Exeed — стилизованная надпись
  exeed: (c) => (
    <text x="24" y="30" fontSize="9" fontWeight="900" fill={c} textAnchor="middle" fontFamily="sans-serif">EXEED</text>
  ),

  // Omoda — стилизованная O с акцентом
  omoda: (c) => (
    <>
      <circle cx="24" cy="24" r="16" stroke={c} strokeWidth="3" fill="none" />
      <circle cx="24" cy="24" r="4" fill={c} />
    </>
  ),

  // Jetour — стилизованная J
  jetour: (c) => (
    <text x="24" y="31" fontSize="11" fontWeight="900" fill={c} textAnchor="middle" fontFamily="sans-serif">JETOUR</text>
  ),

  // Tank — стилизованная T-башня
  tank: (c) => (
    <text x="24" y="31" fontSize="13" fontWeight="900" fill={c} textAnchor="middle" fontFamily="sans-serif">TANK</text>
  ),

  // Zeekr — стилизованная Z
  zeekr: (c) => (
    <path d="M12 10 H36 L16 28 H36 L12 46" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),

  // Li Auto (Lixiang) — стилизованная L
  liauto: (c) => (
    <>
      <path d="M14 8 V40 H36" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="1" fill="none" opacity="0.3" />
    </>
  ),

  // BYD — стилизованная надпись
  byd: (c) => (
    <text x="24" y="31" fontSize="14" fontWeight="900" fill={c} textAnchor="middle" fontFamily="sans-serif">BYD</text>
  ),

  // Hongqi — стилизованный флаг (красная полоса)
  hongqi: (c) => (
    <>
      <path d="M6 18 Q24 8 42 18" stroke={c} strokeWidth="3" fill="none" />
      <rect x="22" y="18" width="4" height="24" fill={c} />
      <path d="M22 18 L32 14 V22 L22 18 Z" fill={c} />
    </>
  ),

  // ===== ЯПОНСКИЕ премиум/прочие =====

  // Subaru — шесть звёзд
  subaru: (c) => (
    <>
      {[
        [24, 14], [14, 22], [34, 22], [18, 32], [30, 32], [24, 38],
      ].map(([cx, cy], i) => (
        <path
          key={i}
          d={`M${cx} ${cy - 4} L${cx + 1} ${cy - 1} L${cx + 4} ${cy - 1} L${cx + 1.5} ${cy + 1} L${cx + 2.5} ${cy + 4} L${cx} ${cy + 2} L${cx - 2.5} ${cy + 4} L${cx - 1.5} ${cy + 1} L${cx - 4} ${cy - 1} L${cx - 1} ${cy - 1} Z`}
          fill={c}
        />
      ))}
    </>
  ),

  // Mitsubishi — три ромба
  mitsubishi: (c) => (
    <>
      <path d="M24 6 L30 18 L24 24 L18 18 Z" fill={c} />
      <path d="M10 30 L22 24 L24 30 L18 36 Z" fill={c} />
      <path d="M38 30 L26 24 L24 30 L30 36 Z" fill={c} />
    </>
  ),

  // Acura — стилизованная A в круге (калипер)
  acura: (c) => (
    <>
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="2.5" fill="none" />
      <path d="M16 38 L24 8 L32 38 M20 28 H28" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),

  // ===== КОРЕЙСКИЕ =====

  // Genesis — стилизованная крыла
  genesis: (c) => (
    <text x="24" y="30" fontSize="8" fontWeight="700" fill={c} textAnchor="middle" letterSpacing="1">GENESIS</text>
  ),

  // ===== ПРОЧЕЕ =====

  // Land Rover — стилизованная надпись
  landrover: (c) => (
    <text x="24" y="29" fontSize="6.5" fontWeight="700" fill={c} textAnchor="middle" fontFamily="sans-serif">LAND ROVER</text>
  ),

  // Volvo — символ мужского (стрелка) в круге
  volvo: (c) => (
    <>
      <circle cx="24" cy="24" r="18" stroke={c} strokeWidth="2.5" fill="none" />
      <path d="M24 6 V14 M20 10 L24 6 L28 10" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M16 32 L24 16 L32 32 M19 26 H29" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),

  // Peugeot — лев (стилизация)
  peugeot: (c) => (
    <text x="24" y="30" fontSize="7" fontWeight="700" fill={c} textAnchor="middle">PEUGEOT</text>
  ),

  // Citroen — двойной шеврон
  citroen: (c) => (
    <>
      <path d="M16 24 L24 14 L32 24" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M12 32 L24 18 L36 32" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),

  // Great Wall — стени башни (стилизация)
  greatwall: (c) => (
    <text x="24" y="30" fontSize="6" fontWeight="700" fill={c} textAnchor="middle">GREAT WALL</text>
  ),

  // Jetta — стилизованная надпись
  jetta: (c) => (
    <text x="24" y="30" fontSize="8" fontWeight="900" fill={c} textAnchor="middle">JETTA</text>
  ),

  // Tesla — стилизованная T
  tesla: (c) => (
    <>
      <path d="M14 12 H34 M24 12 V38" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M20 18 Q24 22 28 18" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
}

/** Список всех поддерживаемых брендов (для валидации) */
export const SUPPORTED_BRANDS = Object.keys(LOGOS)

/** Проверка наличия логотипа */
export function hasBrandLogo(brand: string): boolean {
  return !!LOGOS[normalizeBrand(brand)]
}
