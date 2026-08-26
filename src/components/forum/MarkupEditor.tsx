"use client"

import { useRef, useState } from "react"
import { Box, Button, Group, Textarea, Text, Tooltip } from "@mantine/core"
import {
  IconBold,
  IconCode,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconQuote,
  IconStrikethrough,
} from "@tabler/icons-react"
import { applyLinePrefix, applyMarkup, renderForumMarkup } from "@/lib/forum-markup"

/**
 * Поле сообщения с панелью форматирования.
 *
 * Голое поле ввода на форуме о технике неудобно: человек перечисляет
 * работы списком, цитирует собеседника, выделяет номер ошибки. Без этого
 * длинные ответы превращаются в стену текста, которую не читают.
 *
 * Панель ставит пометки Markdown в текст, а не хранит разметку: почему
 * именно так — в шапке src/lib/forum-markup.ts.
 */

type Props = {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  minRows?: number
  disabled?: boolean
}

/** Кнопки, оборачивающие выделение. */
const WRAP_BUTTONS = [
  { marker: "**", label: "Жирный", hint: "Ctrl+B", Icon: IconBold },
  { marker: "*", label: "Курсив", hint: "Ctrl+I", Icon: IconItalic },
  { marker: "~~", label: "Зачёркнутый", hint: "", Icon: IconStrikethrough },
  { marker: "`", label: "Код или номер детали", hint: "", Icon: IconCode },
] as const

/** Кнопки, размечающие строки целиком. */
const PREFIX_BUTTONS = [
  { prefix: "- ", label: "Список", Icon: IconList },
  { prefix: "1. ", label: "Нумерованный список", Icon: IconListNumbers },
  { prefix: "> ", label: "Цитата", Icon: IconQuote },
] as const

export default function MarkupEditor({
  value,
  onChange,
  label = "Сообщение",
  placeholder,
  minRows = 4,
  disabled,
}: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)

  /**
   * Применяет изменение и возвращает курсор на место.
   *
   * Без восстановления выделения курсор прыгает в конец после каждой
   * кнопки, и набирать дальше невозможно.
   */
  const applyAndRestore = (next: { value: string; selectionStart: number; selectionEnd: number }) => {
    onChange(next.value)
    requestAnimationFrame(() => {
      const area = areaRef.current
      if (!area) return
      area.focus()
      area.setSelectionRange(next.selectionStart, next.selectionEnd)
    })
  }

  const wrap = (marker: string) => {
    const area = areaRef.current
    if (!area) return
    applyAndRestore(applyMarkup(value, area.selectionStart, area.selectionEnd, marker))
  }

  const prefix = (linePrefix: string) => {
    const area = areaRef.current
    if (!area) return
    applyAndRestore(applyLinePrefix(value, area.selectionStart, area.selectionEnd, linePrefix))
  }

  const insertLink = () => {
    const area = areaRef.current
    if (!area) return
    const selected = value.slice(area.selectionStart, area.selectionEnd)
    const text = selected || "текст ссылки"
    const inserted = `[${text}](https://)`
    const nextValue = value.slice(0, area.selectionStart) + inserted + value.slice(area.selectionEnd)
    /* Курсор встаёт в адрес: текст ссылки человек обычно уже выделил, а
       адрес нужно вставить. */
    const urlStart = area.selectionStart + text.length + 3
    applyAndRestore({ value: nextValue, selectionStart: urlStart, selectionEnd: urlStart + 8 })
  }

  /* Привычные сочетания: человек, пишущий длинный ответ, тянется к
     Ctrl+B, а не к панели. */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!event.ctrlKey && !event.metaKey) return
    const key = event.key.toLowerCase()
    if (key === "b") { event.preventDefault(); wrap("**") }
    if (key === "i") { event.preventDefault(); wrap("*") }
    if (key === "k") { event.preventDefault(); insertLink() }
  }

  return (
    <Box>
      <Group justify="space-between" align="flex-end" gap="xs" mb={4} wrap="wrap">
        <Text size="sm" fw={500}>{label}</Text>
        {/* Предпросмотр переключателем, а не второй колонкой: на экране в
            390 пикселей две колонки не помещаются. */}
        <Button
          variant="subtle"
          size="compact-xs"
          color="gray"
          onClick={() => setPreview((current) => !current)}
          disabled={disabled}
        >
          {preview ? "Вернуться к правке" : "Предпросмотр"}
        </Button>
      </Group>

      {!preview && (
        <Group gap={2} mb={4} wrap="wrap" className="markup-toolbar">
          {WRAP_BUTTONS.map(({ marker, label: buttonLabel, hint, Icon }) => (
            <Tooltip key={marker} label={hint ? `${buttonLabel} (${hint})` : buttonLabel} withArrow>
              <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                px={8}
                onClick={() => wrap(marker)}
                disabled={disabled}
                aria-label={buttonLabel}
              >
                <Icon size={15} />
              </Button>
            </Tooltip>
          ))}

          <Box className="markup-toolbar__divider" />

          {PREFIX_BUTTONS.map(({ prefix: linePrefix, label: buttonLabel, Icon }) => (
            <Tooltip key={linePrefix} label={buttonLabel} withArrow>
              <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                px={8}
                onClick={() => prefix(linePrefix)}
                disabled={disabled}
                aria-label={buttonLabel}
              >
                <Icon size={15} />
              </Button>
            </Tooltip>
          ))}

          <Box className="markup-toolbar__divider" />

          <Tooltip label="Ссылка (Ctrl+K)" withArrow>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              px={8}
              onClick={insertLink}
              disabled={disabled}
              aria-label="Ссылка"
            >
              <IconLink size={15} />
            </Button>
          </Tooltip>
        </Group>
      )}

      {preview ? (
        <Box className="markup-preview">
          {value.trim() ? (
            <div
              className="forum-post-body"
              /* Разметка собрана своим разбором с экранированием всего
                 постороннего — см. src/lib/forum-markup.ts. */
              dangerouslySetInnerHTML={{ __html: renderForumMarkup(value) }}
            />
          ) : (
            <Text size="sm" c="var(--market-muted)">Здесь появится то, что увидят читатели.</Text>
          )}
        </Box>
      ) : (
        <>
          <Textarea
            ref={areaRef}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            minRows={minRows}
            autosize
            size="sm"
            disabled={disabled}
          />
          <Text size="xs" c="var(--market-muted)" mt={3}>
            Можно писать пометками: <code>**жирный**</code>, <code>*курсив*</code>, <code>- список</code>, <code>&gt; цитата</code>
          </Text>
        </>
      )}
    </Box>
  )
}
