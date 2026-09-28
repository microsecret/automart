/**
 * Сводка причин, когда в прогоне упали лоты.
 *
 * Прогон, где не прошёл ни один лот, получал FAILED с пустой ошибкой:
 * причины лежали в ответе по каждому лоту, а в запись прогона не попадали.
 * Замер 28.09.2026: 17 таких прогонов за 36 часов (IAUTOS, Carvago, Encar) —
 * в админке и в журнале не было видно, что случилось.
 *
 * Берётся самая частая причина: одна и та же ошибка у всех лотов — это
 * поломка источника, а не лотов.
 */
export function summarizeItemFailures(failed: ReadonlyArray<{ error?: unknown }>, total: number): string | null {
  if (!failed.length) return null
  const counts = new Map<string, number>()
  for (const item of failed) {
    const reason = typeof item.error === "string" && item.error.trim() ? item.error.trim().slice(0, 200) : "без описания"
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  const [reason, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return `Не прошли ${failed.length} из ${total}; чаще всего (${count}): ${reason}`.slice(0, 500)
}
