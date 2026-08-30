"use client"

import { useState } from "react"
import { Menu, UnstyledButton } from "@mantine/core"
import { IconBrandTelegram, IconBrandVk, IconBrandWhatsapp, IconCheck, IconLink, IconShare } from "@tabler/icons-react"
import { tapFeedback } from "@/lib/telegram-webapp"

/* Домен для ссылки: на клиенте — тот, где человек сейчас, чтобы с
   тестового стенда не расходились ссылки на продакшн. */
function shareOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin
  return "https://lewheel.ru"
}

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
  stationId,
  stationName,
  address,
  latitude,
  longitude,
  availableFuels,
  priceSummary,
  updatedLabel,
  className,
}: {
  /** Нужен для ссылки: по ней карта открывается сразу на этой точке. */
  stationId: string
  stationName: string
  address: string | null
  latitude: number
  longitude: number
  /** Марки, которые есть по свежим отметкам: ради них и пересылают. */
  availableFuels: string[]
  /** «92 — 63,20 ₽»: цена решает не меньше наличия. */
  priceSummary?: string
  /** «13 минут назад»: без свежести наличие ничего не значит. */
  updatedLabel?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  /* Ссылка ведёт на нашу карту, а не в Яндекс.

     Раньше человек пересылал другу ссылку на Яндекс.Карты: тот видел
     точку на чужой карте, где нет ни наличия, ни цен, ни возможности
     отметить. Сервис отдавал свою же находку конкуренту и не получал
     ни одного нового человека.

     Адрес открывает карту сразу на этой заправке: id точки плюс
     координаты, чтобы её нашли даже когда у пришедшего запомнен
     другой город. */
  const mapUrl = `${shareOrigin()}/services/fuel-map?station=${encodeURIComponent(stationId)}&lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}`

  /* Текст называет вещи своими именами.

     «Есть: 92» человек читал как загадку: 92 чего, у кого, когда.
     Теперь сказано, что это бензин, что сведения от водителей и
     насколько они свежие — по этому получатель решает, ехать ли. */
  const fuelsLine = availableFuels.length
    ? `Есть в наличии: ${availableFuels.join(", ")}`
    : "Наличие пока никто не отмечал"
  const priceLine = priceSummary ? `Цены: ${priceSummary}` : ""
  const freshnessLine = updatedLabel ? `По отметкам водителей, обновлено ${updatedLabel}` : "По отметкам водителей"

  const text = [
    `⛽ ${stationName}`,
    address || "",
    fuelsLine,
    priceLine,
    freshnessLine,
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
