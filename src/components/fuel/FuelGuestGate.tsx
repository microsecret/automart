"use client"

import Link from "next/link"
import { Box, Button, Group, Stack, Text } from "@mantine/core"
import { IconBell, IconBrandTelegram, IconGasStation, IconMapPin, IconUserPlus } from "@tabler/icons-react"
import { cityInPrepositional } from "@/lib/city-declension"

/**
 * Приглашение войти поверх карты АЗС.
 *
 * Сервис держится на отметках водителей: цену с колонки и очередь на
 * заправке никакой скрейпер не привезёт, это видит только человек, который
 * там стоит. Поэтому гостю показывают несколько заправок целиком — чтобы
 * он убедился, что данные живые и свежие, — а остальные закрывают.
 *
 * Прежняя версия закрывала карту просьбой: «чем больше водителей отмечают,
 * тем точнее у всех». Просьба верная, но обращена не к тому: человек
 * пришёл узнать, где заправиться, а его звали в соавторы сервиса. Замер на
 * боевом сервере это подтвердил — двести двенадцать регистраций и три
 * подписки на уведомления, то есть о главной возможности почти никто не
 * узнал.
 *
 * Теперь сначала идёт личная выгода, и каждое обещание проверено по коду:
 * уведомления о появлении топлива действительно рассылаются (FuelSubscription
 * и рассылка в scripts/run-fuel-digest.sh), вход через Telegram — один шаг
 * без пароля (двести одиннадцать регистраций из двухсот двенадцати пришли
 * именно так).
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

/* Что человек получает лично. Порядок не случаен: сначала то, ради чего
   он открыл карту, потом то, о чём он не знал и что возвращает его сюда
   завтра. */
const BENEFITS = [
  {
    icon: IconMapPin,
    title: "Все заправки города",
    text: "Цены и наличие по каждой, а не по четырём ближайшим",
  },
  {
    icon: IconBell,
    title: "Бот напишет, когда появится топливо",
    text: "Выбираете марку и город — сообщение приходит в Telegram",
  },
  {
    icon: IconGasStation,
    title: "Отметка в одно касание",
    text: "Увидели цену на табло — отметили, и её увидят остальные",
  },
] as const

export default function FuelGuestGate({ stationCount, pricedCount, reportsToday, cityLabel, returnPath }: Props) {
  const callbackUrl = encodeURIComponent(returnPath)
  const telegramUrl = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?startapp=fuel` : null

  return (
    <Box className="fuel-gate">
      <Stack gap="md" className="fuel-gate__card">
        <Stack gap={4}>
          <Group gap="xs">
            <IconGasStation size={20} />
            <Text fw={800} fz={19} lh={1.2}>Цены на топливо в {cityInPrepositional(cityLabel)}</Text>
          </Group>
          {/* Числа идут сразу за заголовком: они доказывают, что за
              приглашением стоит работающий сервис, а не пустая форма. */}
          <Text size="sm" c="dimmed">
            {stationCount} заправок на карте, {pricedCount} с ценами и наличием
            {typeof reportsToday === "number" && reportsToday > 0 ? `, ${reportsToday} отметок за сутки` : ""}
          </Text>
        </Stack>

        {/* Выгода списком, а не сплошным текстом.

            Прежний абзац объяснял, как устроен сервис. Это интересно тому,
            кто уже внутри; тому, кто решает, входить ли, важно другое —
            что он получит. Три строки читаются за пару секунд, абзац
            пропускают. */}
        <Stack gap="sm" className="fuel-gate__benefits">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <Group key={title} gap={10} align="flex-start" wrap="nowrap">
              <Box className="fuel-gate__benefit-icon" aria-hidden="true">
                <Icon size={17} stroke={1.9} />
              </Box>
              <Box>
                <Text fw={700} fz="sm" lh={1.3}>{title}</Text>
                <Text size="xs" c="dimmed" lh={1.4}>{text}</Text>
              </Box>
            </Group>
          ))}
        </Stack>

        <Stack gap="xs">
          {telegramUrl && (
            <Button
              component="a"
              href={telegramUrl}
              size="md"
              leftSection={<IconBrandTelegram size={20} />}
              fullWidth
            >
              Войти через Telegram
            </Button>
          )}
          {/* Обещание проверяемое: вход через Telegram действительно не
              просит ни пароля, ни почты, ни подтверждения. */}
          <Text size="xs" ta="center" c="dimmed">
            Одно касание, без пароля и почты
          </Text>
          <Button
            component={Link}
            href={`/auth/signup?callbackUrl=${callbackUrl}`}
            size="sm"
            variant="subtle"
            leftSection={<IconUserPlus size={16} />}
            fullWidth
          >
            Или обычная регистрация
          </Button>
          <Text size="xs" ta="center" c="dimmed">
            Уже есть аккаунт?{" "}
            <Link href={`/auth/signin?callbackUrl=${callbackUrl}`} className="fuel-gate__link">
              Войти
            </Link>
          </Text>
        </Stack>
      </Stack>
    </Box>
  )
}
