"use client"

import { useRef, useState } from "react"
import { ActionIcon, Group, Text } from "@mantine/core"
import { IconPhotoPlus, IconStar, IconStarFilled, IconX } from "@tabler/icons-react"
import styles from "./product-photos.module.css"

const MAX_PHOTOS = 8

/**
 * Фото позиции: до восьми, первое — обложка в каталоге.
 *
 * Файлы грузятся сразу при выборе, по одному: при обрыве связи теряется
 * один снимок, а не вся пачка. Обложку меняют звёздочкой — перетаскивание
 * на телефоне неудобно и не нужно для одной операции.
 */
export default function ProductPhotosField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    const room = MAX_PHOTOS - value.length
    const batch = Array.from(files).slice(0, room)
    if (files.length > room) setError(`Можно не больше ${MAX_PHOTOS} фото`)
    let next = [...value]
    for (const file of batch) {
      setUploading((count) => count + 1)
      try {
        const form = new FormData()
        form.append("file", file)
        const response = await fetch("/api/upload", { method: "POST", body: form })
        const payload = await response.json().catch(() => null)
        if (!response.ok || typeof payload?.url !== "string") {
          setError(typeof payload?.error === "string" ? payload.error : "Не удалось загрузить фото")
          continue
        }
        next = [...next, payload.url]
        onChange(next)
      } catch {
        setError("Связь прервалась — фото не загрузилось")
      } finally {
        setUploading((count) => count - 1)
      }
    }
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div>
      <div className={styles.grid}>
        {value.map((url, index) => (
          <div key={url} className={styles.photo} data-cover={index === 0 || undefined}>
            <img src={url} alt="" />
            {index === 0 && <span className={styles.coverBadge}>Обложка</span>}
            <Group gap={4} className={styles.tools}>
              {index > 0 && (
                <ActionIcon size="sm" variant="white" color="dark" aria-label="Сделать обложкой" onClick={() => onChange([url, ...value.filter((item) => item !== url)])}>
                  <IconStar size={14} />
                </ActionIcon>
              )}
              {index === 0 && value.length > 1 && <IconStarFilled size={14} className={styles.coverStar} aria-hidden="true" />}
              <ActionIcon size="sm" variant="white" color="red" aria-label="Удалить фото" onClick={() => onChange(value.filter((item) => item !== url))}>
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, index) => <div key={`loading-${index}`} className={styles.loading} aria-busy="true" />)}
        {value.length + uploading < MAX_PHOTOS && (
          <button type="button" className={styles.add} onClick={() => inputRef.current?.click()}>
            <IconPhotoPlus size={24} stroke={1.5} />
            <span>{value.length ? "Ещё фото" : "Добавить фото"}</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => upload(event.currentTarget.files)} />
      <Text size="xs" c={error ? "red" : "dimmed"} mt={6}>
        {error || "JPEG, PNG или WebP до 10 МБ. Первое фото — обложка в каталоге; лучше на светлом фоне."}
      </Text>
    </div>
  )
}
