/**
 * Фирменные цвета брендов авто для лейблов.
 * Используется в карточках, сайдбаре, странице бренда.
 */

const BRAND_COLORS: Record<string, string> = {
  // Немцы
  "BMW": "#0066B1",
  "Mercedes-Benz": "#00A19C",
  "Audi": "#BB0A30",
  "Volkswagen": "#001E50",
  "Porsche": "#D5001C",
  "Opel": "#F7FF14",
  // Японцы
  "Toyota": "#EB0A1E",
  "Lexus": "#1B1B1B",
  "Nissan": "#C3002F",
  "Honda": "#CC0000",
  "Mazda": "#101010",
  "Mitsubishi": "#D60011",
  "Subaru": "#0040AF",
  "Suzuki": "#CC0000",
  // Корейцы
  "Kia": "#05141F",
  "Hyundai": "#002C5F",
  "Genesis": "#121111",
  // Китайцы
  "Geely": "#0046AE",
  "Chery": "#0046AE",
  "Haval": "#0046AE",
  "Changan": "#1A1A1A",
  "Exeed": "#1B1B1B",
  "Omoda": "#00A3E0",
  "Jetour": "#003D7A",
  "Tank": "#C41E3A",
  "BYD": "#E60012",
  "Zeekr": "#000000",
  "Li Auto": "#1A8FE3",
  "Hongqi": "#C8102E",
  // Россия
  "Lada (ВАЗ)": "#005BAC",
  "УАЗ": "#0066B3",
  "ГАЗ": "#1A1A1A",
  "Москвич": "#E63946",
  // Американцы
  "Ford": "#003478",
  "Chevrolet": "#CD9836",
  "Tesla": "#CC0000",
  "Jeep": "#000000",
  // Европа
  "Renault": "#FFCC33",
  "Peugeot": "#00A3E0",
  "Skoda": "#0E3A2F",
  "Volvo": "#1A57A5",
  "Land Rover": "#00563F",
}

/** Получить цвет бренда (fallback — серый) */
export function getBrandColor(brand: string): string {
  return BRAND_COLORS[brand] || "var(--mantine-color-dimmed)"
}

/** Генерирует контрастный текст (белый/чёрный) по фоновому цвету */
export function getContrastText(bgColor: string): string {
  const hex = bgColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "var(--mantine-color-text)" : "#ffffff"
}
