"use client"

import { useState } from "react"
import { Button, Collapse, Group, Paper, Stack, Text } from "@mantine/core"
import { IconSearch } from "@tabler/icons-react"
import PartRequestForm from "./PartRequestForm"

/**
 * «Не нашли деталь? Оставьте заявку» — под выдачей каталога.
 *
 * Форма заявки была спрятана в витрине категорий, которая показывалась
 * только при пустой выдаче без фильтров — то есть почти никогда. На неё
 * при этом ссылались витрина магазина и кабинет: человек приходил и формы
 * не находил. Показывается только при работающих магазинах — без них
 * ответить на заявку некому, и обещание было бы пустым.
 */
export default function PartRequestPrompt({ activeStores }: { activeStores: number }) {
  const [opened, setOpened] = useState(false)
  if (activeStores <= 0) return null

  return (
    <Paper id="part-request" withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" gap="sm" wrap="wrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <IconSearch size={20} style={{ color: "var(--market-accent-button)", flexShrink: 0 }} />
            <div>
              <Text fw={700} size="sm">Не нашли нужную деталь?</Text>
              <Text size="xs" c="dimmed">Оставьте заявку — проверенные магазины пришлют цену и срок и свяжутся с вами.</Text>
            </div>
          </Group>
          {!opened && <Button size="sm" onClick={() => setOpened(true)}>Оставить заявку</Button>}
        </Group>
        <Collapse in={opened}>
          <PartRequestForm />
        </Collapse>
      </Stack>
    </Paper>
  )
}
