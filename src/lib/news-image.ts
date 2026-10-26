/**
 * Какие обложки новостей пропускать через оптимизатор картинок Next.
 *
 * Список совпадает с remotePatterns в next.config.js: адрес с другого
 * домена оптимизатор отвергает, и картинка пропадает. Поэтому чужие домены
 * показываются как есть, а эти — уменьшенными под слот.
 *
 * Жил в ленте новостей сайта; вынесен, чтобы мини-приложение решало так же.
 * s0.rbk.ru добавлен 26.10.2026: за месяц 63 обложки, и самая тяжёлая
 * весила 259 КБ — на телефоне это была главная картинка экрана, 2.1 секунды.
 */
export const OPTIMIZABLE_NEWS_HOSTS: ReadonlySet<string> = new Set([
  "www.zr.ru",
  "avatars.avto.ru",
  "resizer.mail.ru",
  "img-renderer.rambler.ru",
  "kolesa-uploads.ru",
  "s0.rbk.ru",
])

export function isOptimizableNewsImage(url: string): boolean {
  if (url.startsWith("/")) return true
  try {
    return OPTIMIZABLE_NEWS_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}
