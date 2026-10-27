import SectionArtworkHeader from "@/components/ui/SectionArtworkHeader"
import Link from "next/link"
import { Box, Text, Paper, Group, Stack, SimpleGrid, Anchor } from "@mantine/core"
import ServiceArtwork, { type ServiceArtworkKind } from "@/components/ui/ServiceArtwork"

const SECTIONS = [
  { art: "publish-listing", title: "Как продать авто", desc: "Пошаговое руководство для продавцов", href: "/help/sell", color: "#1c4291" },
  { art: "safe-deal", title: "Сопровождение сделки", desc: "Проверка документов, статусы и сопровождение покупки", href: "/services/safe-deal", color: "#059669" },
  { art: "history-check", title: "Безопасность", desc: "Как защититься от мошенников", href: "/help/safety", color: "#dc2626" },
  { art: "documents", title: "Правила площадки", desc: "Условия использования, модерация", href: "/help/rules", color: "#1c4291" },
  /* Заявка на деталь. Справка рассказывала, как продать машину и куда
     жаловаться, но не про самый частый тупик покупателя: нужной детали
     нет ни в одном каталоге, и человек уходит, не зная, что её можно
     заказать через заявку. */
  { art: "parts", title: "Не нашли запчасть", desc: "Оставьте заявку — магазины ответят ценой и сроком", href: "/parts-finder", color: "#1d4ed8" },
  /* Одна карточка вместо двух: «Поддержка» и «Частые вопросы» вели на
     один и тот же адрес /help/support — человек нажимал разное, а
     попадал в одно место. Семь карточек при трёх колонках давали ряд
     3+3+1 с сиротой внизу; шесть встают ровно. */
  { art: "messages", title: "Поддержка и вопросы", desc: "Ответы на частые вопросы и связь с командой", href: "/help/support", color: "#ea580c" },
]

export default function HelpPage() {
  return (
    <Box p={{ base: "sm", md: "lg" }}>
      <Stack gap="lg" maw={1000} mx="auto">
        <SectionArtworkHeader scene="help" title="Помощь и поддержка">
          <p>Помощь по объявлениям, безопасности и сделкам на LeWheel</p>
        </SectionArtworkHeader>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {SECTIONS.map((s) => {
            return (
              <Link key={s.title} href={s.href} style={{ textDecoration: "none" }}>
                {/* Прежний JS-hover двигал карточку через transform, которого не было
                    в transition: подъём происходил рывком, а на тач-экране подсветка
                    залипала, потому что mouseleave после тапа не приходит. */}
                <Paper p="lg" radius="md" withBorder className="market-linked-card" style={{ cursor: "pointer", height: "100%" }}>
                  <Group gap="md" align="flex-start">
                    <ServiceArtwork kind={s.art as ServiceArtworkKind} size={60} />
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Text fw={700} fz="md" c="var(--market-ink)">{s.title}</Text>
                      <Text size="sm" c="var(--market-muted)">{s.desc}</Text>
                    </Stack>
                  </Group>
                </Paper>
              </Link>
            )
          })}
        </SimpleGrid>
        <Paper p="xl" radius="md" style={{ background: "var(--lw-enamel-base)" }}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={0}>
              <Text fw={800} fz="lg" c="white">Не нашли ответ?</Text>
              <Text size="sm" c="rgba(255,255,255,0.85)">Создайте обращение — ответ появится в личном кабинете</Text>
            </Stack>
            <Anchor href="/help/support" c="white" fw={700} className="inline-touch-link" style={{ textDecoration: "underline" }}>Написать в поддержку →</Anchor>
          </Group>
        </Paper>
      </Stack>
    </Box>
  )
}
