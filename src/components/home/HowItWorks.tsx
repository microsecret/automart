"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Box, Button, Group, Stack, Text } from "@mantine/core"
import { IconArrowRight, IconBell, IconGasStation, IconSearch, IconShieldCheck } from "@tabler/icons-react"

/**
 * Что здесь можно сделать — для человека, который зашёл впервые.
 *
 * Главная показывала объявления и направления, но не объясняла, чем
 * площадка отличается от соседних и зачем на ней заводить учётную запись.
 * Замер на боевом сервере: двести двенадцать пользователей и три подписки
 * на уведомления — о половине возможностей просто никто не узнал.
 *
 * Блок показывается только гостю: вошедшему он бесполезен и занимал бы
 * первый экран рассказом о том, чем человек уже пользуется.
 *
 * Шаги сменяются сами, но каждый остаётся на экране целиком: это не
 * карусель, где содержимое уезжает вбок, а подсветка одного из четырёх.
 * Уехавший шаг человек не дочитывает, а подсвеченный — успевает.
 */

const STEPS = [
  {
    icon: IconSearch,
    title: "Найдите машину или запчасть",
    text: "Легковые, мото, грузовики, спецтехника и водный транспорт — в одном каталоге вместе с запчастями под вашу модель.",
    href: "/search",
    action: "Открыть каталог",
  },
  {
    icon: IconGasStation,
    title: "Посмотрите, где заправиться",
    text: "Цены и наличие топлива по отметкам водителей — тех, кто прямо сейчас стоит у колонки. Плюс очереди на заправках.",
    href: "/services/fuel-map",
    action: "Открыть карту АЗС",
  },
  {
    icon: IconBell,
    title: "Подпишитесь на нужное",
    text: "Бот напишет в Telegram, когда появится ваша марка топлива или выйдет объявление под ваш запрос.",
    href: "/services/fuel-map",
    action: "Настроить уведомления",
  },
  {
    icon: IconShieldCheck,
    title: "Проведите сделку спокойно",
    text: "Проверка истории по VIN, оценка рыночной цены и готовые документы для договора купли-продажи.",
    href: "/services",
    action: "Смотреть сервисы",
  },
] as const

/* Шаг держится на экране столько, чтобы его успели прочитать: три
   предложения при обычной скорости чтения — около пяти секунд. */
const STEP_DURATION_MS = 5_000

export default function HowItWorks() {
  const [active, setActive] = useState(0)
  /* Смена останавливается, как только человек сам выбрал шаг: дальше
     листать за него — значит отнимать то, что он читает. */
  const [isAuto, setIsAuto] = useState(true)

  useEffect(() => {
    if (!isAuto) return
    /* Уважение к системной настройке: тому, кто отключил анимацию, шаги
       не переключаются вовсе — он выбирает их сам. */
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduced) return

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % STEPS.length)
    }, STEP_DURATION_MS)
    return () => window.clearInterval(timer)
  }, [isAuto])

  const current = STEPS[active]
  const CurrentIcon = current.icon

  return (
    <Box className="how-it-works" component="section" aria-label="Что можно сделать на площадке">
      <Stack gap={2} className="how-it-works__head">
        <Text component="h2" fw={800} fz={{ base: 20, md: 24 }} c="var(--market-ink)">
          Что здесь можно сделать
        </Text>
        <Text size="sm" c="dimmed">
          Площадка про весь путь владельца: от покупки до заправки по дороге.
        </Text>
      </Stack>

      <Box className="how-it-works__body">
        {/* Слева — все шаги списком: человек видит целое, а не отрывок. */}
        <Stack gap={6} className="how-it-works__steps" role="tablist" aria-label="Возможности площадки">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon
            const isActive = index === active
            return (
              <button
                key={step.title}
                type="button"
                role="tab"
                aria-selected={isActive}
                className="how-it-works__step"
                data-active={isActive ? "true" : undefined}
                onClick={() => {
                  setActive(index)
                  setIsAuto(false)
                }}
              >
                <span className="how-it-works__step-icon" aria-hidden="true">
                  <StepIcon size={17} stroke={1.9} />
                </span>
                <span className="how-it-works__step-title">{step.title}</span>
              </button>
            )
          })}
        </Stack>

        {/* Справа — подробность выбранного шага. */}
        <Box className="how-it-works__detail" key={current.title}>
          <Box className="how-it-works__detail-icon" aria-hidden="true">
            <CurrentIcon size={26} stroke={1.7} />
          </Box>
          <Stack gap={8}>
            <Text fw={800} fz="lg" lh={1.25} c="var(--market-ink)">{current.title}</Text>
            <Text size="sm" c="dimmed" lh={1.5}>{current.text}</Text>
            <Group gap="xs">
              <Button
                component={Link}
                href={current.href}
                size="sm"
                rightSection={<IconArrowRight size={15} />}
              >
                {current.action}
              </Button>
            </Group>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
