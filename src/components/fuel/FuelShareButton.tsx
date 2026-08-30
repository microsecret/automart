"use client"

import { useState } from "react"
import { Menu, UnstyledButton } from "@mantine/core"
import { IconBrandTelegram, IconBrandVk, IconBrandWhatsapp, IconCheck, IconLink, IconShare } from "@tabler/icons-react"
import { tapFeedback } from "@/lib/telegram-webapp"

/**
 * Поделиться заправкой.
 *
 * Человек нашёл, где есть бензин, и первое, что он делает, — говорит об
 * этом другу или в чат. Раньше кнопка открывала системное окно, а на
 * настольном браузере молча копировала ссылку в буфер: нажал — ничего
 * не произошло, и было непонятно, сработало ли.
 *
 * Теперь выбор сетей виден сразу. Telegram, ВКонтакте и WhatsApp
 * покрывают почти все пересылки в России; «Ещё» открывает системное
 * окно телефона, где есть и Instagram, и всё остальное установленное.
 * Instagram Stories отдельной строкой нет намеренно: из браузера туда
 * можно отправить только картинку через мобильное приложение, и кнопка,
 * которая на десктопе ничего не делает, хуже её отсутствия.
 */
export default function FuelShareButton({
  stationName,
  address,
  latitude,
  longitude,
  availableFuels,
  className,
}: {
  stationName: string
  address: string | null
  latitude: number
  longitude: number
  /** Марки, которые есть по свежим отметкам: ради них и пересылают. */
  availableFuels: string[]
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const mapUrl = `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=17`
  const text = [
    `⛽ ${stationName}`,
    address || "",
    availableFuels.length ? `Есть: ${availableFuels.join(", ")}` : "",
  ].filter(Boolean).join("\n")
  const fullText = `${text}\n${mapUrl}`

  const openShare = (url: string) => {
    tapFeedback("light")
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const copyLink = async () => {
    tapFeedback("light")
    try {
      await navigator.clipboard.writeText(fullText)
      /* Подтверждение обязательно: без него человек не знает,
         скопировалось ли, и жмёт ещё раз. */
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Буфер закрыт настройками браузера — молчим, человек увидит,
         что подписи «скопировано» не появилось. */
    }
  }

  const openSystemShare = () => {
    tapFeedback("light")
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator.share({ title: stationName, text, url: mapUrl }).catch(() => undefined)
      return
    }
    void copyLink()
  }

  return (
    <Menu shadow="md" width={210} radius="md" position="top">
      <Menu.Target>
        <UnstyledButton className={`fuel-share ${className || ""}`.trim()} aria-label="Поделиться заправкой">
          {copied ? <IconCheck size={16} /> : <IconShare size={16} />}
          <span>{copied ? "Скопировано" : "Поделиться"}</span>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconBrandTelegram size={16} color="#229ED9" />}
          onClick={() => openShare(`https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`)}
        >
          Telegram
        </Menu.Item>
        <Menu.Item
          leftSection={<IconBrandVk size={16} color="#0077FF" />}
          onClick={() => openShare(`https://vk.com/share.php?url=${encodeURIComponent(mapUrl)}&title=${encodeURIComponent(stationName)}&comment=${encodeURIComponent(text)}`)}
        >
          ВКонтакте
        </Menu.Item>
        <Menu.Item
          leftSection={<IconBrandWhatsapp size={16} color="#25D366" />}
          onClick={() => openShare(`https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`)}
        >
          WhatsApp
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<IconLink size={16} />} onClick={() => void copyLink()}>
          Скопировать ссылку
        </Menu.Item>
        {/* Системное окно телефона: в нём Instagram, почта, заметки и
            всё, что человек поставил себе сам. На настольном браузере
            его нет, и пункт скрыт. */}
        {typeof navigator !== "undefined" && Boolean(navigator.share) && (
          <Menu.Item leftSection={<IconShare size={16} />} onClick={openSystemShare}>
            Ещё…
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
