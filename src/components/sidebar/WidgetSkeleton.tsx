import { Box, Button, Text } from "@mantine/core"
import SidebarEmblem from "./SidebarEmblem"

export function WidgetUnavailable({ tone, title, retry, isRetrying }: {
  tone: "news" | "lots" | "listings"
  title: string
  retry: () => void
  isRetrying: boolean
}) {
  return (
    <section className="side-widget" data-tone={tone} aria-label={title}>
      <div className="side-widget__head">
        <Text component="h2" className="side-widget__title"><SidebarEmblem tone={tone} />{title}</Text>
      </div>
      <Box className="side-widget__body" p="sm">
        <Text size="xs" c="var(--market-muted)" role="status">Временно недоступно</Text>
        <Button size="compact-xs" variant="subtle" mt={5} loading={isRetrying} onClick={retry}>Повторить</Button>
      </Box>
    </section>
  )
}

/**
 * Заглушка виджета на время загрузки.
 *
 * Замер на медленной сети: карточки машин в центре уже отрисованы, а
 * правая треть экрана — белое пятно, потому что виджеты возвращают
 * null, пока не пришли данные. Человек видит незаконченную страницу и
 * не понимает, будет ли там что-нибудь.
 *
 * Заглушка повторяет будущую разметку: цветная шапка и строки той же
 * высоты. Когда данные приедут, содержимое встанет на своё место, и
 * страница не дёрнется — а это дёрганье и есть главная неприятность
 * позднего появления блоков.
 *
 * Строки не мигают: пульсация четырёх блоков подряд превращает колонку
 * в мерцающее полотно, от которого рябит в глазах сильнее, чем от
 * пустоты. Достаточно того, что место занято.
 */
export default function WidgetSkeleton({ tone, rows = 5 }: { tone: string; rows?: number }) {
  return (
    <Box className="side-widget side-widget--skeleton" data-tone={tone} aria-hidden="true">
      <Box className="side-widget__head">
        <span className="side-widget__title-ghost" />
      </Box>
      <Box className="side-widget__body">
        {Array.from({ length: rows }, (_, i) => (
          <Box key={i} className="side-widget__row-ghost">
            {/* Две полосы разной длины: строка виджета почти всегда
                состоит из названия и числа под ним. */}
            <span className="side-widget__line" style={{ width: `${68 + ((i * 7) % 22)}%` }} />
            <span className="side-widget__line side-widget__line--short" />
          </Box>
        ))}
      </Box>
    </Box>
  )
}
