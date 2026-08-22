"use client"

import useSWR from "swr"
import { Anchor, Button, CopyButton, Group, Paper, Text, ThemeIcon } from "@mantine/core"
import { IconBrandTelegram, IconCheck, IconCopy, IconGift } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"

type ReferralResponse = { link?: string; code?: string }

/**
 * Приглашение поделиться площадкой.
 *
 * Новый пользователь — единственный человек, который прямо сейчас кому-то
 * рассказывает про покупку машины. Ссылка под рукой в этот момент приводит
 * больше людей, чем баннер на главной, а вознаграждение делает интерес
 * взаимным.
 */
export default function ShareInviteCard() {
  const { data } = useSWR<ReferralResponse>("/api/referral", fetchJson, { revalidateOnFocus: false })
  const link = data?.link
  if (!link) return null

  const shareText = "Нашёл площадку для авто и запчастей — тут аукционы Кореи, Китая и Японии с расчётом доставки"
  const telegramShare = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`

  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" color="teal" size={34} radius="md"><IconGift size={18} /></ThemeIcon>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={700}>Расскажите о нас</Text>
          <Text size="xs" c="dimmed">
            Отправьте ссылку знакомым — за их платные объявления начисляется вознаграждение.{" "}
            <Anchor component="a" href="/dashboard/referral" size="xs">Условия</Anchor>
          </Text>
          <Group gap="xs" mt="sm" wrap="wrap">
            <Button
              component="a"
              href={telegramShare}
              target="_blank"
              rel="noopener noreferrer"
              size="compact-sm"
              color="teal"
              leftSection={<IconBrandTelegram size={15} />}
            >
              Отправить в Telegram
            </Button>
            <CopyButton value={link} timeout={2_000}>
              {({ copied, copy }) => (
                <Button
                  size="compact-sm"
                  variant="light"
                  color={copied ? "teal" : "gray"}
                  onClick={copy}
                  leftSection={copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                >
                  {copied ? "Скопировано" : "Копировать ссылку"}
                </Button>
              )}
            </CopyButton>
          </Group>
        </div>
      </Group>
    </Paper>
  )
}
