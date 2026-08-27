"use client"

import { useRef, useState } from "react"
import { Box, Button, Group, Textarea, Text, Tooltip, Loader } from "@mantine/core"
import {
  IconAt,
  IconBold,
  IconCode,
  IconEyeOff,
  IconH2,
  IconH3,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconMinus,
  IconPhoto,
  IconQuote,
  IconSourceCode,
  IconStrikethrough,
  IconTable,
  IconVideo,
} from "@tabler/icons-react"
import { applyLinePrefix, applyMarkup, renderForumMarkup } from "@/lib/forum-markup"
import PostBody from "@/components/forum/PostBody"

/**
 * Поле сообщения с панелью форматирования.
 *
 * Голое поле ввода на форуме о технике неудобно: человек перечисляет
 * работы списком, цитирует собеседника, показывает фотографию поломки,
 * сравнивает комплектации таблицей. Без этого длинные ответы
 * превращаются в стену текста, которую не читают.
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
  { marker: "||", label: "Спойлер: скрыть ответ", hint: "", Icon: IconEyeOff },
] as const

/** Кнопки, размечающие строки целиком. */
const PREFIX_BUTTONS = [
  { prefix: "## ", label: "Заголовок", Icon: IconH2 },
  { prefix: "### ", label: "Подзаголовок", Icon: IconH3 },
  { prefix: "- ", label: "Список", Icon: IconList },
  { prefix: "1. ", label: "Нумерованный список", Icon: IconListNumbers },
  { prefix: "> ", label: "Цитата", Icon: IconQuote },
] as const

/* Заготовка таблицы: пустую разметку человек дописать не может, а по
   образцу с подписанными столбцами — сразу видно, куда что ставить. */
const TABLE_TEMPLATE = "\n| Что | Значение |\n| --- | --- |\n|  |  |\n"

/** Что принимает загрузка: тот же список, что и в /api/upload. */
const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp"

export default function MarkupEditor({
  value,
  onChange,
  label = "Сообщение",
  placeholder,
  minRows = 4,
  disabled,
}: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

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

  /** Вставляет готовый кусок текста на место курсора. */
  const insertAtCursor = (text: string, selectFrom?: number, selectLength?: number) => {
    const area = areaRef.current
    if (!area) return
    const start = area.selectionStart
    const nextValue = value.slice(0, start) + text + value.slice(area.selectionEnd)
    const caret = selectFrom === undefined ? start + text.length : start + selectFrom
    applyAndRestore({
      value: nextValue,
      selectionStart: caret,
      selectionEnd: caret + (selectLength ?? 0),
    })
  }

  const insertLink = () => {
    const area = areaRef.current
    if (!area) return
    const selected = value.slice(area.selectionStart, area.selectionEnd)
    const text = selected || "текст ссылки"
    /* Курсор встаёт в адрес: текст ссылки человек обычно уже выделил, а
       адрес нужно вставить. */
    insertAtCursor(`[${text}](https://)`, text.length + 3, 8)
  }

  const insertVideo = () => {
    /* Подсказка адресом, а не пустой строкой: иначе непонятно, что сюда
       нужна именно ссылка на ролик, а не файл. */
    insertAtCursor("\nhttps://\n", 1, 8)
  }

  const insertTable = () => insertAtCursor(TABLE_TEMPLATE)

  const insertDivider = () => insertAtCursor("\n---\n")

  const insertMention = () => insertAtCursor("@", 1, 0)

  const insertCodeBlock = () => {
    const area = areaRef.current
    if (!area) return
    const selected = value.slice(area.selectionStart, area.selectionEnd)
    const body = selected || ""
    insertAtCursor(`\n\`\`\`\n${body}\n\`\`\`\n`, 5 + body.length, 0)
  }

  /**
   * Загружает картинку и вставляет пометку на месте курсора.
   *
   * Разметка принимает только адреса с нашего сервера — почему именно
   * так, в шапке src/lib/forum-markup.ts.
   */
  const uploadImage = async (file: File) => {
    if (uploading || disabled) return
    setUploadError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch("/api/upload", { method: "POST", body: form })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.url) {
        setUploadError(data?.error || "Не удалось загрузить картинку")
        return
      }
      /* Подпись остаётся пустой намеренно: заполненная «изображение»
         попадёт в описание страницы для поиска и в озвучку для незрячих,
         не сказав ничего. */
      insertAtCursor(`\n![](${data.url})\n`)
    } catch {
      setUploadError("Не удалось загрузить картинку")
    } finally {
      setUploading(false)
    }
  }

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) void uploadImage(file)
  }

  /* Вставка из буфера: снимок экрана с ошибкой на панели приборов
     копируют и вставляют, а не сохраняют файлом. */
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith("image/"))
    if (!item) return
    const file = item.getAsFile()
    if (!file) return
    event.preventDefault()
    void uploadImage(file)
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

  /** Кнопка панели: вид у всех одинаковый, различаются значком и делом. */
  const toolButton = (key: string, tip: string, Icon: typeof IconBold, onClick: () => void) => (
    <Tooltip key={key} label={tip} withArrow>
      <Button
        variant="subtle"
        color="gray"
        size="compact-sm"
        px={8}
        onClick={onClick}
        disabled={disabled}
        aria-label={tip}
      >
        <Icon size={15} />
      </Button>
    </Tooltip>
  )

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
          {WRAP_BUTTONS.map(({ marker, label: buttonLabel, hint, Icon }) =>
            toolButton(marker, hint ? `${buttonLabel} (${hint})` : buttonLabel, Icon, () => wrap(marker)))}

          <Box className="markup-toolbar__divider" />

          {PREFIX_BUTTONS.map(({ prefix: linePrefix, label: buttonLabel, Icon }) =>
            toolButton(linePrefix, buttonLabel, Icon, () => prefix(linePrefix)))}

          <Box className="markup-toolbar__divider" />

          {toolButton("link", "Ссылка (Ctrl+K)", IconLink, insertLink)}
          {toolButton("mention", "Упомянуть участника", IconAt, insertMention)}
          {toolButton("codeblock", "Блок кода или лог ошибок", IconSourceCode, insertCodeBlock)}
          {toolButton("table", "Таблица", IconTable, insertTable)}
          {toolButton("divider", "Разделитель", IconMinus, insertDivider)}
          {toolButton("video", "Видео с YouTube, RuTube или VK", IconVideo, insertVideo)}

          <Tooltip label="Картинка: можно перетащить файл или вставить из буфера" withArrow>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              px={8}
              onClick={() => fileRef.current?.click()}
              disabled={disabled || uploading}
              aria-label="Картинка"
            >
              {uploading ? <Loader size={13} /> : <IconPhoto size={15} />}
            </Button>
          </Tooltip>

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_IMAGES}
            hidden
            onChange={(event) => {
              handleFiles(event.currentTarget.files)
              /* Сброс значения: без него повторный выбор того же файла не
                 вызывает события, и вторая попытка выглядит поломкой. */
              event.currentTarget.value = ""
            }}
          />
        </Group>
      )}

      {preview ? (
        <Box className="markup-preview">
          {value.trim() ? (
            /* Тем же компонентом, что и в теме: иначе спойлер в
               предпросмотре не раскрывался бы, и автор не мог проверить,
               что именно спрятал. */
            <PostBody html={renderForumMarkup(value)} />
          ) : (
            <Text size="sm" c="var(--market-muted)">Здесь появится то, что увидят читатели.</Text>
          )}
        </Box>
      ) : (
        <>
          <Box
            className={dragging ? "markup-dropzone markup-dropzone--active" : "markup-dropzone"}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              handleFiles(event.dataTransfer.files)
            }}
          >
            <Textarea
              ref={areaRef}
              value={value}
              onChange={(event) => onChange(event.currentTarget.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              minRows={minRows}
              autosize
              size="sm"
              disabled={disabled}
            />
          </Box>

          {uploadError && (
            <Text size="xs" c="red" mt={3} role="alert">{uploadError}</Text>
          )}

          <Text size="xs" c="var(--market-muted)" mt={3}>
            Пометки: <code>**жирный**</code>, <code>*курсив*</code>, <code>## заголовок</code>,
            {" "}<code>&gt; цитата</code>, <code>||спойлер||</code>. Картинку можно перетащить в поле или вставить из буфера.
          </Text>
        </>
      )}
    </Box>
  )
}
