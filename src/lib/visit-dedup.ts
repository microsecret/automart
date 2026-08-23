/**
 * Отсечение повторных отправок одного и того же экрана.
 *
 * Браузеры и service worker переотправляют beacon — без защиты один просмотр
 * превращался бы в два-три. Но защита не должна съедать настоящие переходы:
 * раньше она искала в базе любое событие с тем же путём за последние десять
 * секунд, поэтому смена фильтра каталога («/auctions?country=JP» →
 * «?country=KR») и быстрый возврат назад просмотром не считались.
 *
 * Экран запоминается в памяти процесса: приложение обслуживается одним
 * процессом Next.js за Nginx, как и счётчики `rate-limit`. Перезапуск сервиса
 * очищает карту — в худшем случае один лишний просмотр сразу после деплоя,
 * что дешевле потерянных переходов.
 */

/** Окно, в котором повтор того же экрана считается дублем отправки. */
export const VISIT_RETRY_WINDOW_MS = 10_000

/** Потолок карты: без него редкие посетители копились бы до конца аптайма. */
const MAX_TRACKED_VISITORS = 20_000
const SWEEP_INTERVAL_MS = 60_000

export type VisitScreenState = { screen: string; at: number }

const lastScreens = new Map<string, VisitScreenState>()
let lastSweepAt = Date.now()

/**
 * Экран визита: путь вместе со строкой запроса, если она есть.
 *
 * В базу пишется чистый путь — топ разделов группируется по нему и с
 * фильтрами размазался бы на сотни строк. Экран нужен только чтобы отличить
 * повторную отправку от перехода.
 */
export function visitScreen(path: string, screen: unknown): string {
  if (typeof screen !== "string") return path
  const trimmed = screen.trim().slice(0, 400)
  // Экран обязан начинаться с того же пути: иначе клиент прислал что-то своё,
  // и доверять ему при дедупликации нельзя.
  return trimmed === path || trimmed.startsWith(`${path}?`) ? trimmed : path
}

/**
 * Считать ли отправку повтором.
 *
 * Повтор — тот же экран того же посетителя внутри окна. Другой экран
 * (сменился путь или фильтры) — настоящий переход, и он считается всегда,
 * даже если случился через секунду.
 */
export function isRepeatedVisit(
  incoming: { screen: string; at: number },
  previous: VisitScreenState | null | undefined,
  windowMs: number = VISIT_RETRY_WINDOW_MS,
): boolean {
  if (!previous) return false
  if (previous.screen !== incoming.screen) return false
  const elapsed = incoming.at - previous.at
  // Отрицательная разница означает рассинхрон часов: такое событие лучше
  // записать, чем молча потерять.
  return elapsed >= 0 && elapsed < windowMs
}

function sweep(now: number) {
  for (const [key, value] of lastScreens) {
    if (now - value.at >= VISIT_RETRY_WINDOW_MS) lastScreens.delete(key)
  }
}

/**
 * Записать экран и ответить, был ли это повтор.
 *
 * Проверка и запись — одно действие: раздельные вызовы позволяли бы двум
 * одновременным beacon-ам разойтись между чтением и записью и обоим пройти.
 */
export function registerVisitScreen(visitorId: string, screen: string, at: number = Date.now()): boolean {
  if (at - lastSweepAt >= SWEEP_INTERVAL_MS || lastScreens.size >= MAX_TRACKED_VISITORS) {
    sweep(at)
    lastSweepAt = at
  }
  const previous = lastScreens.get(visitorId)
  const repeated = isRepeatedVisit({ screen, at }, previous)
  /* Отметка времени у повтора не обновляется: иначе окно сдвигалось бы с
     каждой отправкой, и человек, обновляющий страницу раз в девять секунд,
     не засчитывался бы никогда. */
  if (!repeated) lastScreens.set(visitorId, { screen, at })
  return repeated
}

/** Сброс состояния — нужен тестам, чтобы они не влияли друг на друга. */
export function resetVisitScreens() {
  lastScreens.clear()
  lastSweepAt = Date.now()
}
