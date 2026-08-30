"use client"

import { useCallback, useState } from "react"
import { notifications } from "@mantine/notifications"

const MAX_IMAGES = 12

export function useMarketplaceImageUpload(initialImages: string[] = []) {
  const [images, setImages] = useState<string[]>(initialImages.slice(0, MAX_IMAGES))
  const [uploadingImages, setUploadingImages] = useState(false)

  const replaceImages = useCallback((nextImages: string[]) => {
    setImages(Array.from(new Set(nextImages.filter((image) => typeof image === "string" && image.length > 0))).slice(0, MAX_IMAGES))
  }, [])

  const removeImage = useCallback((index: number) => {
    setImages((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }, [])

  const uploadPhotos = useCallback(async (files: File[] | null) => {
    const selected = Array.isArray(files) ? files : []
    if (selected.length === 0) return

    const freeSlots = Math.max(0, MAX_IMAGES - images.length)
    if (freeSlots === 0) {
      notifications.show({ title: "Лимит фотографий", message: `В объявление можно добавить до ${MAX_IMAGES} фотографий.`, color: "orange" })
      return
    }

    setUploadingImages(true)
    try {
      const batch = selected.slice(0, freeSlots)
      /* Каждая фотография живёт своей судьбой.

         Здесь стоял Promise.all: первый же отказ отменял всё
         присвоение, и снимки, уже загруженные на сервер, в форму не
         попадали. Человек выбирал восемь фотографий с телефона, ждал
         минуту на мобильном интернете и получал пустую сетку с
         сообщением об ошибке — при том что четыре из них лежали на
         сервере.

         allSettled доводит до конца все: удачные добавляются, про
         неудачные говорим числом, чтобы человек знал, сколько
         доложить. */
      const outcomes = await Promise.allSettled(batch.map(async (file) => {
        const formData = new FormData()
        formData.append("file", file)
        const response = await fetch("/api/upload", { method: "POST", body: formData })
        const result = await response.json().catch(() => ({})) as { url?: string; error?: string }
        if (!response.ok || !result.url) throw new Error(result.error || "Не удалось загрузить фотографию")
        return result.url
      }))

      const urls = outcomes.flatMap((outcome) => outcome.status === "fulfilled" ? [outcome.value] : [])
      const failed = outcomes.length - urls.length

      if (urls.length) {
        setImages((current) => Array.from(new Set([...current, ...urls])).slice(0, MAX_IMAGES))
      }

      if (failed > 0) {
        /* Первая причина отказа вернее общих слов: «файл больше 10 МБ»
           подсказывает, что делать, а «повторите попытку» — нет. */
        const firstError = outcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult | undefined
        const reason = firstError?.reason instanceof Error ? firstError.reason.message : null
        notifications.show({
          title: urls.length ? "Загрузились не все фото" : "Не удалось загрузить фото",
          message: urls.length
            ? `Добавлено ${urls.length} из ${outcomes.length}${reason ? `. ${reason}` : ""}`
            : reason || "Повторите попытку.",
          color: urls.length ? "orange" : "red",
        })
      } else if (selected.length > freeSlots) {
        notifications.show({ title: "Добавлены не все фото", message: `Добавлено ${freeSlots} из ${selected.length}: достигнут лимит.`, color: "orange" })
      }
    } catch (error) {
      notifications.show({
        title: "Не удалось загрузить фото",
        message: error instanceof Error ? error.message : "Повторите попытку.",
        color: "red",
      })
    } finally {
      setUploadingImages(false)
    }
  }, [images.length])

  return { images, uploadingImages, uploadPhotos, removeImage, replaceImages }
}
