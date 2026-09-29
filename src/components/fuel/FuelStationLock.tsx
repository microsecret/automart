"use client"

import Link from "next/link"
import { Button, Group, Stack, Text } from "@mantine/core"
import { IconBrandTelegram, IconLock } from "@tabler/icons-react"

/**
 * Замок на карточке заправки для гостя.
 *
 * Раньше поверх карты всегда висела плашка «Войти через Telegram»: на
 * телефоне она закрывала полэкрана, и человек видел приглашение раньше,
 * чем карту. Владелец попросил иначе: карта открыта всем, а цены и наличие
 * топлива скрыты до входа — приглашение появляется в тот момент, когда
 * человек нажал на заправку и хочет узнать, что там есть. Интерес уже
 * есть, и вход становится ответом на его вопрос, а не препятствием.
 *
 * Шапка карточки (название, адрес, часы) остаётся видимой: по ней видно,
 * что данные настоящие, закрыто только то, ради чего входят.
 */

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ""

export default function FuelStationLock({ returnPath, stationId, wantsSubscribe = false }: {
  /** Куда вернуть после входа — на ту же карту и ту же заправку. */
  returnPath: string
  stationId: string
  /** Пришли по кнопке «Сообщать мне о таком»: вход сразу ведёт к подписке. */
  wantsSubscribe?: boolean
}) {
  const callbackUrl = encodeURIComponent(returnPath)
  /* Дефисы в startapp Telegram не пропускает — мини-приложение возвращает
     их обратно из подчёркиваний. */
  const startParam = wantsSubscribe ? `fuelsub_${stationId.replace("-", "_")}` : "fuel"
  const telegramUrl = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?startapp=${startParam}` : null

  return (
    <div className="fuel-station-lock" role="region" aria-label="Цены и наличие после входа">
      <Stack gap={10} className="fuel-station-lock__card">
        <Group gap={8} wrap="nowrap" justify="center">
          <IconLock size={18} stroke={2} aria-hidden="true" />
          <Text fw={800} size="sm" lh={1.25}>Цены и наличие топлива — после входа</Text>
        </Group>
        <Text size="xs" c="dimmed" ta="center" lh={1.45}>
          Войдите через Telegram или зарегистрируйтесь: откроются все заправки города, свежие отметки водителей и
          уведомления, когда топливо появится.
        </Text>
        {telegramUrl && (
          <Button component="a" href={telegramUrl} size="sm" leftSection={<IconBrandTelegram size={18} />} fullWidth>
            Войти через Telegram
          </Button>
        )}
        <Group gap={8} grow>
          <Button component={Link} href={`/auth/signup?callbackUrl=${callbackUrl}`} size="xs" variant="light">
            Регистрация
          </Button>
          <Button component={Link} href={`/auth/signin?callbackUrl=${callbackUrl}`} size="xs" variant="subtle">
            Войти
          </Button>
        </Group>
      </Stack>
    </div>
  )
}
