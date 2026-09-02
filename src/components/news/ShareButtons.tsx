"use client"

import { useEffect, useState } from "react"
import { ActionIcon, CopyButton, Group, Text, Tooltip } from "@mantine/core"
import { IconBrandTelegram, IconBrandWhatsapp, IconBrandVk, IconCheck, IconLink, IconMail } from "@tabler/icons-react"

/**
 * Кнопки «поделиться» под новостью.
 *
 * Ссылки собираются на клиенте из адреса страницы — без виджетов соцсетей:
 * их скрипты тянут на страницу чужой код и трекеры, а здесь достаточно
 * обычной ссылки, которую мессенджер раскроет сам.
 */
export default function ShareButtons({ title }: { title: string }) {
  // Адрес читается после монтирования: на сервере window нет, и разметка
  // должна совпасть с клиентской, иначе React ругается на несоответствие.
  const [shareUrl, setShareUrl] = useState("")
  useEffect(() => setShareUrl(window.location.href), [])
  if (!shareUrl) return null

  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedTitle = encodeURIComponent(title)

  const targets = [
    { label: "Telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`, Icon: IconBrandTelegram, color: "blue" },
    { label: "WhatsApp", href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`, Icon: IconBrandWhatsapp, color: "teal" },
    { label: "ВКонтакте", href: `https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}`, Icon: IconBrandVk, color: "indigo" },
    { label: "Почтой", href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`, Icon: IconMail, color: "gray" },
  ] as const

  return (
    <Group gap={6} align="center" wrap="wrap">
      <Text size="xs" c="dimmed" fw={600}>Поделиться</Text>
      {targets.map(({ label, href, Icon, color }) => (
        <Tooltip key={label} label={label} withArrow>
          <ActionIcon
            component="a"
            href={href}
            target="_blank"
            // noopener закрывает открытой вкладке доступ к window.opener,
            // noreferrer не отдаёт соцсети адрес страницы-источника.
            rel="noopener noreferrer nofollow"
            variant="light"
            color={color}
            size="lg"
            aria-label={`Поделиться в ${label}`}
          >
            <Icon size={18} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      ))}
      <CopyButton value={shareUrl} timeout={1800}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? "Ссылка скопирована" : "Скопировать ссылку"} withArrow>
            <ActionIcon
              variant="light"
              color={copied ? "teal" : "gray"}
              size="lg"
              onClick={copy}
              aria-label="Скопировать ссылку на новость"
            >
              {copied ? <IconCheck size={18} stroke={1.8} /> : <IconLink size={18} stroke={1.8} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  )
}
