"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge, Button, Group, Modal, Paper, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core"
import {
  IconAdjustmentsAlt, IconArmchair, IconBolt, IconBox, IconBrandSpeedtest,
  IconBulb, IconCar, IconCarCrane, IconDroplet, IconEngine, IconSearch,
  IconSettings, IconShoppingBag, IconSnowflake, IconTool, IconWind,
} from "@tabler/icons-react"
import { PART_SUBCATEGORIES, PART_TYPES } from "@/lib/constants"
import PartRequestForm from "./PartRequestForm"

/**
 * Витрина раздела запчастей, пока в каталоге нет позиций.
 *
 * Раньше здесь стояла серая плашка «Раздел пока пуст» посреди пустого
 * экрана, а боковое меню и подвал звали в разделы, которых нет. Сайт
 * обещал и не давал — это хуже плохой вёрстки.
 *
 * Показывать выдуманные товары нельзя: люди станут писать по
 * несуществующим объявлениям. Поэтому витрина показывает то, что есть
 * на самом деле — разбор по видам деталей — и принимает заявки.
 */

/** Значок для каждой категории: по названию человек находит нужное быстрее, чем по списку. */
const CATEGORY_ICONS: Record<string, typeof IconEngine> = {
  ENGINE: IconEngine,
  TRANSMISSION: IconSettings,
  SUSPENSION: IconCarCrane,
  BRAKES: IconBrandSpeedtest,
  ELECTRICAL: IconBolt,
  BODY: IconCar,
  INTERIOR: IconArmchair,
  WHEELS: IconAdjustmentsAlt,
  LIGHTING: IconBulb,
  COOLING: IconSnowflake,
  EXHAUST: IconWind,
  STEERING: IconTool,
  ACCESSORIES: IconShoppingBag,
  CONSUMABLES: IconDroplet,
  OTHER: IconBox,
}

export default function PartsShowcase() {
  const [requestFor, setRequestFor] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const openRequest = (category: string | null) => {
    setRequestFor(category)
    setModalOpen(true)
  }

  return (
    <Stack gap="lg">
      {/* Приглашение к заявке идёт первым: человек пришёл за деталью, и
          первое, что он должен увидеть, — способ её получить, а не
          сообщение о том, что каталог пуст. */}
      <Paper radius="lg" p="lg" className="parts-hero" withBorder>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Stack gap={6} style={{ flex: 1, minWidth: 260 }}>
            <Text component="h2" fz={{ base: 22, sm: 26 }} fw={800} c="var(--market-ink)" ff="var(--font-display),sans-serif" lh={1.15}>
              Опишите деталь. Магазины ответят предложениями
            </Text>
            <Text size="sm" c="dimmed" maw={520}>
              Каталог наполняется. Пока быстрее не искать по витрине, а оставить заявку:
              продавцы сами найдут деталь и напишут цену и срок.
            </Text>
          </Stack>

          <Button
            onClick={() => openRequest(null)}
            leftSection={<IconSearch size={18} />}
            color="indigo"
            radius="md"
            size="md"
            className="parts-hero__cta"
          >
            Оставить заявку
          </Button>
        </Group>
      </Paper>

      <Stack gap="xs">
        <Group justify="space-between" align="baseline" wrap="wrap" gap="xs">
          <Text component="h2" fz="lg" fw={800} c="var(--market-ink)" ff="var(--font-display),sans-serif">
            Что ищут чаще всего
          </Text>
          <Text size="xs" c="dimmed">Выберите вид детали, чтобы уточнить заявку</Text>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="sm">
          {PART_TYPES.map((type) => {
            const Icon = CATEGORY_ICONS[type.value] || IconBox
            const subcats = PART_SUBCATEGORIES[type.value] || []

            return (
              <Paper
                key={type.value}
                radius="md"
                p="sm"
                withBorder
                className="parts-category-card"
                component="button"
                type="button"
                onClick={() => openRequest(type.value)}
              >
                <Stack gap={6} align="flex-start">
                  <ThemeIcon variant="light" color="indigo" size={34} radius="md">
                    <Icon size={19} />
                  </ThemeIcon>
                  <Text fw={700} fz="sm" c="var(--market-ink)" lh={1.25} ta="left">
                    {type.label}
                  </Text>
                  {subcats.length > 0 && (
                    <Text size="xs" c="dimmed" lh={1.3} ta="left" lineClamp={2}>
                      {subcats.slice(0, 3).join(", ")}
                    </Text>
                  )}
                </Stack>
              </Paper>
            )
          })}
        </SimpleGrid>
      </Stack>

      {/* Продавцам — отдельный вход. Раздел наполнится только когда придут
          магазины, и просить их об этом надо прямо, а не прятать ссылку
          в подвале. */}
      <Paper radius="lg" p="lg" withBorder className="parts-seller-invite">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Stack gap={4} style={{ flex: 1, minWidth: 240 }}>
            <Group gap={8}>
              <Text fw={800} fz="md" c="var(--market-ink)" ff="var(--font-display),sans-serif">
                Продаёте запчасти?
              </Text>
              <Badge color="teal" variant="light" size="sm" radius="sm">Бесплатно</Badge>
            </Group>
            <Text size="sm" c="dimmed" maw={560}>
              Загрузите прайс файлом, и позиции встанут в каталог. Заявки покупателей
              придут в кабинет магазина.
            </Text>
          </Stack>

          <Group gap="xs">
            <Button component={Link} href="/dashboard/store" variant="light" color="indigo">
              Открыть магазин
            </Button>
            <Button component={Link} href="/listings/create/part" variant="subtle" color="gray">
              Разместить одну деталь
            </Button>
          </Group>
        </Group>
      </Paper>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Заявка на деталь"
        radius="md"
        size="lg"
        centered
      >
        <PartRequestForm
          presetCategory={requestFor}
          onSuccess={() => {
            /* Окно не закрываем: человек должен увидеть подтверждение.
               Закрытие сразу после отправки читается как сбой. */
          }}
        />
      </Modal>
    </Stack>
  )
}
