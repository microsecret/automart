const countries = { JP: "Япония", KR: "Корея", CN: "Китай", US: "США", DE: "Европа", EU: "Европа" }
const bodies = { SUV: "Кроссовер", SEDAN: "Седан", HATCHBACK: "Хэтчбек", WAGON: "Универсал", MINIVAN: "Минивэн", PICKUP: "Пикап", COUPE: "Купе" }
const labels = { q: "Поиск", make: "Марка", model: "Модель", city: "Город", region: "Регион", country: "Страна", bodyType: "Кузов", yearFrom: "Год от", yearTo: "Год до", priceFrom: "Цена от", priceTo: "Цена до" }

/** Readable, bounded preview; raw/unknown provider parameters are not printed.
 * @param {string} query
 * @returns {Array<{label: string, value: string}>}
 */
export function savedSearchSummary(query) {
  const params = new URLSearchParams(query)
  const rows = []
  for (const [key, label] of Object.entries(labels)) {
    const raw = params.get(key)?.trim()
    if (!raw) continue
    let value = raw.slice(0, 120)
    if (key === "country") value = countries[raw] || value
    if (key === "bodyType") value = bodies[raw] || value
    if (key === "priceFrom" || key === "priceTo") {
      if (/^\d+$/.test(raw) && Number.isSafeInteger(Number(raw))) value = `${new Intl.NumberFormat("ru-RU").format(Number(raw))} ₽`
    }
    rows.push({ label, value })
  }
  return rows
}
