"use client"

import Link from "next/link"
import { Box, Button, Group, Stack, Text } from "@mantine/core"
import { IconBrandTelegram, IconUserPlus, IconGasStation, IconUsers } from "@tabler/icons-react"

/**
 * Приглашение войти поверх карты АЗС.
 *
 * Сервис держится на отметках водителей: цену с колонки и очередь на
 * заправке никакой скрейпер не привезёт, это видит только человек, который
 * там стоит. Поэтому гостю показывают несколько заправок целиком — чтобы
 * он убедился, что данные живые и свежие, — а остальные закрывают.
 *
 * Закрыто именно то, ради чего приходят: цены по всему городу. Видно при
 * этом всё, что доказывает работу сервиса: число заправок, свежесть,
 * сколько отметок оставили за сутки. Пустая заглушка вместо карты читалась
 * бы как «сервиса нет», и человек ушёл бы, не поняв, за чем регистрируется.
 */

type Props = {
  /* Сколько заправок в городе и сколько из них с ценами: без этих чисел
     призыв звучит обещанием, а с ними — фактом. */
  stationCount: number
  pricedCount: number
  reportsToday?: number
  cityLabel: string
  /* Куда возвращать после входа: человек продолжает с той же карты, а не
     с главной страницы. */
  returnPath: string
}

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ""

export default function FuelGuestGate({ stationCount, pricedCount, reportsToday, cityLabel, returnPath }: Props) {
  const callbackUrl = encodeURIComponent(returnPath)
  const telegramUrl = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?startapp=fuel` : null

  return (
    <Box className="fuel-gate">
      <Stack gap="md" className="fuel-gate__card">
        <Group gap="xs" justify="center">
          <IconGasStation size={22} />
          <Text fw={800} fz={20} ta="center">Цены на топливо в {cityLabel}</Text>
        </Group>

        {/* Числа идут раньше призыва: они объясняют, что именно человек
            получит, и доказывают, что сервис живой. */}
        <Group gap="lg" justify="center" wrap="wrap">
          <Box ta="center">
            <Text fw={800} fz={24} lh={1.1}>{stationCount}</Text>
            <Text size="xs" c="dimmed">заправок на карте</Text>
          </Box>
          <Box ta="center">
            <Text fw={800} fz={24} lh={1.1}>{pricedCount}</Text>
            <Text size="xs" c="dimmed">с ценами и наличием</Text>
          </Box>
          {typeof reportsToday === "number" && reportsToday > 0 && (
            <Box ta="center">
              <Text fw={800} fz={24} lh={1.1}>{reportsToday}</Text>
              <Text size="xs" c="dimmed">отметок за сутки</Text>
            </Box>
          )}
        </Group>

        <Text size="sm" ta="center">
          Это народный сервис: цены и наличие отмечают сами водители — те, кто прямо сейчас
          стоит на колонке. Скрейпер собирает прайсы, но что залито и где очередь, видно только с места.
        </Text>

        <Stack gap="xs">
          {telegramUrl && (
            <Button
              component="a"
              href={telegramUrl}
              size="md"
              radius="md"
              leftSection={<IconBrandTelegram size={20} />}
              fullWidth
            >
              Открыть в Telegram — вход в одно касание
            </Button>
          )}
          <Button
            component={Link}
            href={`/auth/signup?callbackUrl=${callbackUrl}`}
            size="md"
            radius="md"
            variant={telegramUrl ? "default" : "filled"}
            leftSection={<IconUserPlus size={20} />}
            fullWidth
          >
            Зарегистрироваться на сайте
          </Button>
          <Text size="xs" ta="center" c="dimmed">
            Уже есть аккаунт?{" "}
            <Link href={`/auth/signin?callbackUrl=${callbackUrl}`} className="fuel-gate__link">
              Войти
            </Link>
          </Text>
        </Stack>

        {/* Просьба отмечать стоит после входа, а не до: пока человек не
            внутри, звать его в соавторы рано. */}
        <Group gap={8} align="flex-start" className="fuel-gate__note">
          <IconUsers size={16} />
          <Text size="xs" c="dimmed">
            Чем больше водителей отмечают цены и очереди, тем точнее карта у всех.
            Расскажите про сервис знакомым — вместе мы видим больше, чем поодиночке.
          </Text>
        </Group>
      </Stack>
    </Box>
  )
}
