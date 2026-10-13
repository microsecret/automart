/**
 * Строка поиска: артикул это или слова.
 *
 * «04465-33450», «GDB1330», «90915 YZZD4» — артикулы: есть цифры, не больше
 * двух частей. «колодки camry» — слова. Артикул ведёт на страницу номера с
 * предложениями всех магазинов, слова — в обычный поиск.
 */
export function looksLikeArticle(raw: string) {
  const value = raw.trim()
  if (value.length < 4 || value.length > 40) return false
  if (value.split(/\s+/).length > 2) return false
  const compact = value.toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/g, "")
  if (compact.length < 4 || !/\d/.test(compact)) return false
  /* Слово с цифрой вроде «2107» — номер модели, а не детали: чистое
     число короче шести знаков в артикул не превращаем. */
  if (/^\d{1,5}$/.test(compact)) return false
  return true
}

export function articleHref(raw: string) {
  return `/artikul/${encodeURIComponent(raw.trim())}`
}
