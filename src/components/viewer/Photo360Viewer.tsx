"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Box, Text, Center, ActionIcon, Tooltip, Group } from "@mantine/core"
import { IconArrowsHorizontal, IconMaximize, IconPhoto, IconX } from "@tabler/icons-react"

interface Photo360ViewerProps {
  /** Серия опубликованных ракурсов автомобиля */
  images: string[]
  /** Заголовок полноэкранного просмотра */
  title?: string
}

/**
 * Интерактивный просмотр ракурсов на основе опубликованных фотографий.
 * Горизонтальное перетаскивание последовательно показывает ракурсы, но не
 * выдаёт произвольную серию снимков за подтверждённую 360°-съёмку.
 */
export default function PhotoAngleViewer({ images, title }: Photo360ViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ x: number; idx: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const hasMultipleAngles = images.length >= 3

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!hasMultipleAngles) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, idx: activeIndex }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [activeIndex, hasMultipleAngles])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStart.current || !hasMultipleAngles) return
    const dx = e.clientX - dragStart.current.x
    const step = 24 // px per frame
    const frames = Math.round(dx / step)
    const newIndex = (dragStart.current.idx + frames + images.length * 100) % images.length
    setActiveIndex(newIndex)
  }, [isDragging, hasMultipleAngles, images.length])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
    dragStart.current = null
  }, [])

  // Управление с клавиатуры в полноэкранном режиме.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false)
      if (e.key === "ArrowLeft") setActiveIndex((i) => (i - 1 + images.length) % images.length)
      if (e.key === "ArrowRight") setActiveIndex((i) => (i + 1) % images.length)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen, images.length])

  if (!hasMultipleAngles) {
    // Для одного-двух снимков обычная галерея информативнее интерактивного блока.
    return (
      <Box
        style={{
          aspectRatio: "16/10",
          background: "linear-gradient(135deg, #1a1a1e 0%, #2d2d35 100%)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Center>
          <Box style={{ textAlign: "center" }}>
            <IconPhoto size={56} color="#1c4291" style={{ margin: "0 auto 12px" }} />
            <Text size="sm" c="gray.4" fw={500}>Мало ракурсов для просмотра</Text>
            <Text size="xs" c="gray.6" mt={4}>Используйте основную галерею</Text>
          </Box>
        </Center>
      </Box>
    )
  }

  const currentImage = images[activeIndex] || images[0]

  // Основной просмотрщик
  const viewer = (
    <Box
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: "relative",
        aspectRatio: fullscreen ? "auto" : "16/10",
        height: fullscreen ? "100%" : undefined,
        background: "#0f0f12",
        borderRadius: fullscreen ? 0 : 12,
        overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        touchAction: "pan-y",
      }}
    >
      {/* Изображение */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentImage}
        alt={title || "Просмотр ракурсов автомобиля"}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transition: isDragging ? "none" : "opacity 100ms ease",
        }}
      />

      {/* Индикатор интерактивного просмотра в углу */}
      <Box
        pos="absolute"
        top={12}
        left={12}
        style={{
          background: "rgba(28, 66, 145, 0.9)",
          backdropFilter: "blur(8px)",
          borderRadius: 8,
          padding: "4px 10px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <IconArrowsHorizontal size={16} color="white" />
        <Text size="xs" fw={600} c="white">Ракурсы</Text>
      </Box>

      {/* Подсказка */}
      {!isDragging && !fullscreen && (
        <Box
          pos="absolute"
          bottom={12}
          left="50%"
          style={{
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            borderRadius: 8,
            padding: "6px 14px",
          }}
        >
          <Text size="xs" c="white" style={{ opacity: 0.9 }}>
            ← Тяните, чтобы листать ракурсы →
          </Text>
        </Box>
      )}

      {/* Прогресс-индикатор ракурсов */}
      <Box
        pos="absolute"
        bottom={12}
        right={12}
        style={{
          background: "rgba(0,0,0,0.6)",
          borderRadius: 6,
          padding: "3px 8px",
        }}
      >
        <Text size="10px" c="white" ff="monospace">
          {activeIndex + 1} / {images.length}
        </Text>
      </Box>

      {/* Кнопка полноэкранного режима */}
      {!fullscreen && (
        <Tooltip label="Открыть просмотр фото">
          <ActionIcon
            pos="absolute"
            top={12}
            right={12}
            color="indigo"
            variant="filled"
            size="md"
            radius="md"
            onClick={() => setFullscreen(true)}
            style={{ backdropFilter: "blur(8px)" }}
          >
            <IconMaximize size={18} />
          </ActionIcon>
        </Tooltip>
      )}
    </Box>
  )

  if (!fullscreen) return viewer

  // Полноэкранный режим
  return (
    <Box
      pos="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      style={{ background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column", zIndex: 1000 }}
    >
      {/* Шапка */}
      <Box
        style={{
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Text size="lg" fw={600} c="white">
          {title || "Просмотр ракурсов"}
        </Text>
        <Group gap="sm">
          <Text size="xs" c="gray.4">← → для переключения фото · ESC для выхода</Text>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setFullscreen(false)} aria-label="Закрыть">
            <IconX size={20} color="white" />
          </ActionIcon>
        </Group>
      </Box>

      {/* Просмотрщик */}
      <Box style={{ flex: 1, padding: 20 }}>
        {viewer}
      </Box>

      {/* Миниатюры */}
      <Box style={{ padding: "0 20px 16px", display: "flex", gap: 4, justifyContent: "center", overflowX: "auto" }}>
        {images.map((img, i) => (
          <Box
            key={i}
            onClick={() => setActiveIndex(i)}
            style={{
              width: 48,
              height: 36,
              borderRadius: 4,
              overflow: "hidden",
              border: activeIndex === i ? "2px solid #1c4291" : "2px solid transparent",
              flexShrink: 0,
              cursor: "pointer",
              opacity: activeIndex === i ? 1 : 0.5,
              transition: "border-color 150ms ease, box-shadow 150ms ease, background 150ms ease",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}
