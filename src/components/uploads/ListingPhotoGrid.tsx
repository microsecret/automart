"use client"

import { ActionIcon, Badge, Box, SimpleGrid, Text } from "@mantine/core"
import { IconX } from "@tabler/icons-react"

/**
 * Сетка загруженных фотографий объявления.
 *
 * Одна и та же разметка была скопирована в подачу транспорта, подачу запчасти
 * и редактирование объявления. Копии успели разойтись: в запчастях превью
 * рисовалось через Mantine Image, в остальных — нативным img, а сообщение о
 * ходе загрузки объявлялось скринридеру только на экране редактирования.
 * Продавец, добавляющий фото в объявление о запчасти, не слышал ничего и не
 * понимал, идёт загрузка или форма зависла. Общий компонент убирает это
 * расхождение и не даёт ему появиться снова.
 */
export default function ListingPhotoGrid({ images, uploading, onRemove }: {
  images: string[]
  uploading: boolean
  onRemove: (index: number) => void
}) {
  return (
    <>
      {uploading && <Text size="xs" c="indigo" aria-live="polite">Загружаем фотографии…</Text>}
      {images.length > 0 && (
        <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing="xs">
          {images.map((image, index) => (
            <Box
              key={image}
              pos="relative"
              style={{
                aspectRatio: "1",
                overflow: "hidden",
                borderRadius: 10,
                // Обложка помечена не только подписью: рамка видна и тем, кто
                // просматривает сетку боковым зрением, не читая бейджи.
                border: index === 0 ? "2px solid var(--mantine-color-indigo-5)" : "1px solid var(--mantine-color-gray-3)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={`Фото ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" decoding="async" />
              <ActionIcon
                aria-label={`Удалить фото ${index + 1}`}
                type="button"
                size="sm"
                color="dark"
                variant="filled"
                pos="absolute"
                top={5}
                right={5}
                onClick={() => onRemove(index)}
              >
                <IconX size={13} />
              </ActionIcon>
              {index === 0 && <Badge size="xs" color="indigo" variant="filled" pos="absolute" left={5} bottom={5}>Обложка</Badge>}
            </Box>
          ))}
        </SimpleGrid>
      )}
    </>
  )
}
