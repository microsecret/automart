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
      const urls = await Promise.all(selected.slice(0, freeSlots).map(async (file) => {
        const formData = new FormData()
        formData.append("file", file)
        const response = await fetch("/api/upload", { method: "POST", body: formData })
        const result = await response.json().catch(() => ({})) as { url?: string; error?: string }
        if (!response.ok || !result.url) throw new Error(result.error || "Не удалось загрузить фотографию")
        return result.url
      }))
      setImages((current) => Array.from(new Set([...current, ...urls])).slice(0, MAX_IMAGES))
      if (selected.length > freeSlots) {
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
