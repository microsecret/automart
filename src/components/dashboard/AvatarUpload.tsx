"use client"

import { useRef, useState } from "react"
import { ActionIcon, Avatar, Box, Button, Group, Text, Tooltip } from "@mantine/core"
import { IconCamera, IconTrash } from "@tabler/icons-react"

/**
 * Загрузка аватара в кабинете.
 *
 * Раньше картинка приходила только из Telegram: у тех, кто зарегистрировался
 * на сайте, под каждым сообщением и объявлением стояла буква. На форуме,
 * где важно, кто отвечает, безликий собеседник вызывает меньше доверия.
 */

type Props = {
  currentImage: string | null
  name: string | null
  onChange: (imageUrl: string | null) => void
  disabled?: boolean
}

/** Что принимает загрузка: тот же список, что и в /api/upload. */
const ACCEPTED = "image/jpeg,image/png,image/webp"

export default function AvatarUpload({ currentImage, name, onChange, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch("/api/upload", { method: "POST", body: form })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.url) {
        setError(data?.error || "Не удалось загрузить")
        return
      }
      /* Адрес отдаётся наверх, а не сохраняется здесь: аватар едет вместе
         с именем одним запросом, и два сохранения подряд человеку
         показались бы сбоем. */
      onChange(data.url)
    } catch {
      setError("Не удалось загрузить")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <Group gap="md" align="center">
        <Box style={{ position: "relative" }}>
          <Avatar src={currentImage} size={72} radius="xl" color="indigo">
            {(name || "У").slice(0, 1).toUpperCase()}
          </Avatar>

          {/* Кнопка поверх аватара: так понятно, что нажатие меняет именно
              картинку, а не что-то рядом. */}
          <Tooltip label="Загрузить фото" withArrow>
            <ActionIcon
              variant="filled"
              color="indigo"
              radius="xl"
              size="sm"
              style={{ position: "absolute", right: -2, bottom: -2 }}
              onClick={() => fileRef.current?.click()}
              loading={busy}
              disabled={disabled}
              aria-label="Загрузить фото профиля"
            >
              <IconCamera size={13} />
            </ActionIcon>
          </Tooltip>
        </Box>

        <Box>
          <Text size="sm" fw={500} c="var(--market-ink)">Фото профиля</Text>
          <Text size="xs" c="var(--market-muted)" mt={2}>
            Видно под вашими сообщениями и объявлениями.
          </Text>

          {currentImage && (
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              mt={6}
              leftSection={<IconTrash size={12} />}
              onClick={() => onChange(null)}
              disabled={disabled || busy}
            >
              Убрать
            </Button>
          )}
        </Box>
      </Group>

      {error && <Text size="xs" c="red" mt={6} role="alert">{error}</Text>}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) void upload(file)
          /* Сброс значения: без него повторный выбор того же файла не
             вызывает события, и вторая попытка выглядит поломкой. */
          event.currentTarget.value = ""
        }}
      />
    </Box>
  )
}
