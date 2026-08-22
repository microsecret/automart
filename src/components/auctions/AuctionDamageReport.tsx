"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { Badge, Box, Center, Group, Paper, Stack, Text, ThemeIcon, UnstyledButton } from "@mantine/core"
import { IconCar, IconChevronLeft, IconChevronRight, IconPhotoOff, IconShieldExclamation } from "@tabler/icons-react"
import type { AuctionDamageItem, AuctionDamageKind, AuctionDamageReport as AuctionDamageReportValue } from "@/lib/auction-damage"
import { auctionCardImageUrl, highQualityAuctionImageUrl } from "@/lib/media-url"
import styles from "./AuctionDamageReport.module.css"

const DAMAGE_KIND_META: Readonly<Record<AuctionDamageKind, { label: string; color: string }>> = {
  SERIOUS: { label: "Серьёзное повреждение", color: "#ef4444" },
  COMMON: { label: "Обычное повреждение", color: "#f59e0b" },
  BODY_REPAIR_PAINT: { label: "Кузовной ремонт и окраска", color: "#f97316" },
  REPAINT: { label: "Обычная окраска", color: "#38bdf8" },
  FILM: { label: "Плёнка", color: "#8b5cf6" },
  REPLACED: { label: "Элемент заменён", color: "#64748b" },
}

function markerColor(item: AuctionDamageItem) {
  return DAMAGE_KIND_META[item.kinds.find((kind) => kind !== "COMMON") || "COMMON"].color
}

export default function AuctionDamageReport({ report }: { report: AuctionDamageReportValue }) {
  const [sectionCode, setSectionCode] = useState(report.sections[0]?.code || "")
  const activeSection = report.sections.find((section) => section.code === sectionCode) || report.sections[0]
  const [itemId, setItemId] = useState(activeSection?.items[0]?.id || "")
  const activeItem = activeSection?.items.find((item) => item.id === itemId) || activeSection?.items[0]
  const [photoIndex, setPhotoIndex] = useState(0)
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    const firstSection = report.sections[0]
    setSectionCode(firstSection?.code || "")
    setItemId(firstSection?.items[0]?.id || "")
    setPhotoIndex(0)
    setFailedPhotoUrl(null)
  }, [report])

  const totals = useMemo(() => Object.fromEntries(Object.keys(DAMAGE_KIND_META).map((kind) => [
    kind,
    report.sections.reduce((total, section) => total + section.items.filter((item) => item.kinds.includes(kind as AuctionDamageKind)).length, 0),
  ])) as Record<AuctionDamageKind, number>, [report])

  const sectionPhotos = useMemo(() => activeSection?.items.flatMap((item) => item.photos.map((photo, itemPhotoIndex) => ({
    item,
    photo,
    itemPhotoIndex,
  }))) || [], [activeSection])

  const selectSection = (code: string) => {
    const section = report.sections.find((entry) => entry.code === code)
    setSectionCode(code)
    setItemId(section?.items[0]?.id || "")
    setPhotoIndex(0)
    setFailedPhotoUrl(null)
  }

  const selectItem = (item: AuctionDamageItem) => {
    setItemId(item.id)
    setPhotoIndex(0)
    setFailedPhotoUrl(null)
  }

  const photos = activeItem?.photos || []
  const activePhoto = photos[photoIndex]
  const displayedPhotoUrl = activePhoto ? highQualityAuctionImageUrl(activePhoto.url) : ""
  const photoAvailable = Boolean(displayedPhotoUrl) && failedPhotoUrl !== displayedPhotoUrl
  const sectionPhotoIndex = sectionPhotos.findIndex((entry) => entry.item.id === activeItem?.id && entry.itemPhotoIndex === photoIndex)

  const changePhoto = (offset: number) => {
    if (sectionPhotos.length < 2) return
    const current = sectionPhotoIndex >= 0 ? sectionPhotoIndex : offset > 0 ? -1 : 0
    const next = sectionPhotos[(current + offset + sectionPhotos.length) % sectionPhotos.length]
    setItemId(next.item.id)
    setPhotoIndex(next.itemPhotoIndex)
    setFailedPhotoUrl(null)
  }

  if (!activeSection || !activeItem) return null

  return (
    <Paper className={styles.report} radius="lg" p={{ base: "md", sm: "lg" }} withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon size={42} radius="md" color="orange" variant="light"><IconShieldExclamation size={22} /></ThemeIcon>
            <Box>
              <Text fw={850} fz={{ base: "lg", sm: "xl" }} c="var(--market-ink)">Интерактивная карта состояния автомобиля</Text>
              <Text size="sm" c="dimmed" maw={720}>Нажмите на точку кузова или строку замечания — справа откроется фотография из отчёта осмотра.</Text>
            </Box>
          </Group>
          <Badge color="orange" variant="light" size="lg">{report.sourceLabel}</Badge>
        </Group>

        <Group gap={8} wrap="wrap" aria-label="Условные обозначения повреждений">
          {(Object.keys(DAMAGE_KIND_META) as AuctionDamageKind[]).flatMap((kind) => totals[kind] > 0 ? [
            <Badge key={kind} variant="outline" color="gray" leftSection={<span className={styles.severityDot} style={{ "--damage-marker-color": DAMAGE_KIND_META[kind].color } as CSSProperties} />}>
              {DAMAGE_KIND_META[kind].label}: {totals[kind]}
            </Badge>,
          ] : [])}
        </Group>

        <Box className={styles.sectionTabs} role="tablist" aria-label="Разделы отчёта осмотра">
          {report.sections.map((section) => (
            <UnstyledButton
              key={section.code}
              className={styles.sectionTab}
              data-active={section.code === activeSection.code}
              role="tab"
              aria-selected={section.code === activeSection.code}
              onClick={() => selectSection(section.code)}
            >
              {section.label} · {section.items.length}
            </UnstyledButton>
          ))}
        </Box>

        <Box className={styles.workspace}>
          <Box className={styles.diagram} role="tabpanel" aria-label={`Схема: ${activeSection.label}`}>
            {activeSection.diagramUrl ? (
              // The source diagram shares the same coordinate system as its
              // defect points. Bytes stay at the source and in browser cache.
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.diagramImage} src={auctionCardImageUrl(activeSection.diagramUrl)} alt={`Схема осмотра: ${activeSection.label}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ) : (
              <Center className={styles.diagramEmpty}><Stack align="center" gap={6}><IconCar size={44} stroke={1.5} /><Text size="sm">Схема для этого раздела не опубликована</Text></Stack></Center>
            )}
            {activeSection.items.flatMap((item) => item.x !== null && item.y !== null ? [
              <button
                key={item.id}
                type="button"
                className={styles.marker}
                data-active={item.id === activeItem.id}
                style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, "--damage-marker-color": markerColor(item) } as CSSProperties}
                aria-label={`${item.part}: ${item.note}`}
                aria-pressed={item.id === activeItem.id}
                onClick={() => selectItem(item)}
              />,
            ] : [])}
          </Box>

          <Box className={styles.detailPane} aria-live="polite">
            <Box className={styles.detailCopy}>
              <Text fw={800} c="var(--market-ink)">{activeItem.part}</Text>
              <Text size="sm" c="dimmed" mt={3}>{activeItem.note}</Text>
              <Group gap={6} mt="sm" wrap="wrap">
                {activeItem.kinds.map((kind) => <Badge key={kind} variant="light" color={kind === "SERIOUS" ? "red" : kind === "COMMON" ? "orange" : "indigo"}>{DAMAGE_KIND_META[kind].label}</Badge>)}
              </Group>
            </Box>
            <Box className={styles.photoStage}>
              {photoAvailable ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.photo} src={displayedPhotoUrl} alt={`${activeItem.part}: ${activePhoto.note}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedPhotoUrl(displayedPhotoUrl)} />
              ) : (
                <Center className={styles.photoEmpty}><Stack align="center" gap={6}><IconPhotoOff size={40} stroke={1.5} /><Text size="sm">Источник не приложил фото к этому замечанию</Text></Stack></Center>
              )}
              {sectionPhotos.length > 1 && <>
                <button type="button" className={styles.photoControl} aria-label="Предыдущее фото отчёта" onClick={() => changePhoto(-1)}><IconChevronLeft size={22} /></button>
                <button type="button" className={styles.photoControl} aria-label="Следующее фото отчёта" onClick={() => changePhoto(1)}><IconChevronRight size={22} /></button>
                <span className={styles.photoCounter}>{Math.max(sectionPhotoIndex, 0) + 1} / {sectionPhotos.length}</span>
              </>}
            </Box>
          </Box>
        </Box>

        <Box className={styles.defectList} aria-label={`Замечания: ${activeSection.label}`}>
          {activeSection.items.map((item) => (
            <UnstyledButton key={item.id} className={styles.defectRow} data-active={item.id === activeItem.id} onClick={() => selectItem(item)}>
              <span className={styles.severityDot} style={{ "--damage-marker-color": markerColor(item) } as CSSProperties} />
              <Box><Text size="sm" fw={700}>{item.part}</Text><Text size="xs" c="dimmed" lineClamp={1}>{item.note}</Text></Box>
              <Text size="xs" c="dimmed">{item.photos.length ? `${item.photos.length} фото` : "без фото"}</Text>
            </UnstyledButton>
          ))}
        </Box>

        <Text size="xs" c="dimmed">Показаны только сведения, опубликованные площадкой. Изображения не сохраняются на сервере LeWheel: браузер загружает их по HTTPS из первоисточника при открытии замечания.</Text>
      </Stack>
    </Paper>
  )
}
