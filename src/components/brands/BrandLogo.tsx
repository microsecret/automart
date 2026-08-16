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

const BRAND_KEY_ALIASES: Record<string, string> = {
  "mercedes": "mercedesbenz",
  "mercedesbenz": "mercedesbenz",
  "理想": "liauto",
  "理想汽车": "liauto",
  "蔚来": "nio",
  "小鹏": "xpeng",
  "小鹏汽车": "xpeng",
  "比亚迪": "byd",
  "吉利": "geely",
  "吉利汽车": "geely",
  "奇瑞": "chery",
  "奇瑞汽车": "chery",
  "长安": "changan",
  "长安汽车": "changan",
  "长城": "greatwall",
  "长城汽车": "greatwall",
  "红旗": "hongqi",
  "极氪": "zeekr",
  "岚图": "voyah",
  "零跑": "leapmotor",
  "零跑汽车": "leapmotor",
  "广汽": "gac",
  "阿维塔": "avatr",
  "问界": "aito",
  "腾势": "denza",
  "欧拉": "ora",
  "魏牌": "wey",
  "荣威": "roewe",
  "小米汽车": "xiaomiauto",
  "五菱": "wuling",
  "五菱汽车": "wuling",
}

function normalizeBrand(brand: string): string {
  const normalized = brand
    .toLowerCase()
    .replace(/\(ваз\)/g, "")
    .replace(/[\s\-_/]/g, "")
    .trim()
  return BRAND_KEY_ALIASES[normalized] || normalized
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

  // Cadillac — строгий щит, адаптированный для компактного шильдика.
  cadillac: (c) => (
    <>
      <path d="M24 5 L39 11 V25 C39 35 33 41 24 44 C15 41 9 35 9 25 V11 Z" fill="none" stroke={c} strokeWidth="2.5" />
      <path d="M13 17 H35 M13 24 H35 M17 31 H31" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),

  // Chrysler — лаконичный крылатый знак для мелких размеров.
  chrysler: (c) => (
    <>
      <path d="M5 24 C12 15 18 15 24 21 C30 15 36 15 43 24 C36 30 30 30 24 27 C18 30 12 30 5 24 Z" fill="none" stroke={c} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M19 21 H29 V27 H19 Z" fill={c} />
    </>
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

  // Voyah — парящий симметричный знак.
  voyah: (c) => (
    <path d="M6 17 L20 24 L24 36 L28 24 L42 17 L31 31 L24 43 L17 31 Z" fill="none" stroke={c} strokeWidth="2.8" strokeLinejoin="round" />
  ),

  // Leapmotor — две динамичные дуги.
  leapmotor: (c) => (
    <>
      <path d="M8 29 C14 11 34 11 40 29" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M14 31 C19 23 29 23 34 31" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),

  // GAC — компактная фирменная G-форма.
  gac: (c) => (
    <path d="M38 15 H20 C10 15 7 24 12 32 C15 37 21 39 28 37 H38 V25 H25" stroke={c} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),

  // JAC — пятиконечная звезда в эллипсе.
  jac: (c) => (
    <>
      <ellipse cx="24" cy="24" rx="20" ry="14" stroke={c} strokeWidth="2.5" />
      <path d="M24 12 L27 21 H37 L29 27 L32 36 L24 30 L16 36 L19 27 L11 21 H21 Z" fill={c} />
    </>
  ),

  // Nio — небо и дорога.
  nio: (c) => (
    <>
      <path d="M8 24 Q24 4 40 24 Q24 17 8 24 Z" fill={c} />
      <path d="M11 29 Q24 41 37 29 L31 40 H17 Z" fill={c} />
    </>
  ),

  // Xpeng — симметричный X-знак.
  xpeng: (c) => (
    <path d="M8 11 L21 21 L14 28 L6 20 M40 11 L27 21 L34 28 L42 20 M14 37 L24 27 L34 37" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),

  avatr: (c) => (
    <path d="M7 34 L19 10 H29 L41 34 M14 27 H34 M24 10 V39" stroke={c} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),

  aito: (c) => (
    <text x="24" y="30" fontSize="12" fontWeight="800" fill={c} textAnchor="middle" fontFamily="sans-serif">AITO</text>
  ),

  denza: (c) => (
    <>
      <circle cx="24" cy="24" r="19" stroke={c} strokeWidth="2.5" />
      <path d="M16 34 V14 H24 C32 14 36 18 36 24 C36 30 32 34 24 34 Z" stroke={c} strokeWidth="2.5" fill="none" />
    </>
  ),

  ora: (c) => (
    <>
      <circle cx="24" cy="24" r="18" stroke={c} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="7" stroke={c} strokeWidth="2.5" />
      <path d="M8 24 H16 M32 24 H40" stroke={c} strokeWidth="2.5" />
    </>
  ),

  wey: (c) => (
    <path d="M12 8 H36 L31 40 H17 Z M18 14 L21 34 H27 L30 14 Z" fill={c} fillRule="evenodd" />
  ),

  roewe: (c) => (
    <>
      <path d="M24 5 L39 12 V25 C39 35 33 41 24 44 C15 41 9 35 9 25 V12 Z" stroke={c} strokeWidth="2.5" fill="none" />
      <path d="M16 16 L24 35 L32 16 M19 25 H29" stroke={c} strokeWidth="2.5" fill="none" />
    </>
  ),

  xiaomiauto: (c) => (
    <path d="M8 33 V15 H28 C36 15 40 19 40 27 V33 H34 V27 C34 23 32 21 28 21 H14 V33 Z M18 23 H24 V33 H18 Z" fill={c} />
  ),

  wuling: (c) => (
    <path d="M5 17 L15 11 L24 17 L33 11 L43 17 L33 37 L24 31 L15 37 Z M13 18 L17 27 L24 23 L31 27 L35 18 L29 22 L24 19 L19 22 Z" fill={c} fillRule="evenodd" />
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
