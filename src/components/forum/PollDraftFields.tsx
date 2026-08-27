"use client"

import { ActionIcon, Box, Button, Checkbox, Group, Select, Stack, Text, TextInput } from "@mantine/core"
import { IconPlus, IconX } from "@tabler/icons-react"
import { POLL_LIMITS } from "@/lib/forum-poll"

/**
 * Поля опроса в форме новой темы.
 *
 * Опрос необязателен и по умолчанию свёрнут: большинству тем он не
 * нужен, а развёрнутая форма из вопроса, пяти вариантов и срока сбивает
 * с главного — написать сам вопрос.
 *
 * Состояние держит форма темы: опрос создаётся вторым запросом, уже
 * после темы, и черновик нужен ей целиком.
 */

export type PollDraftState = {
  enabled: boolean
  question: string
  options: string[]
  multiple: boolean
  closesInDays: string | null
}

export const EMPTY_POLL_DRAFT: PollDraftState = {
  enabled: false,
  question: "",
  /* Два поля с самого начала: пустая форма без единого поля не
     объясняет, что от человека нужно, а два — сразу показывают образец. */
  options: ["", ""],
  multiple: false,
  closesInDays: null,
}

/* Сроки предложены готовые, а не полем ввода: «сколько дней» человек
   выбирает из привычных отрезков, а не считает. */
const DURATIONS = [
  { value: "3", label: "3 дня" },
  { value: "7", label: "неделя" },
  { value: "30", label: "месяц" },
]

type Props = {
  value: PollDraftState
  onChange: (next: PollDraftState) => void
  disabled?: boolean
}

export default function PollDraftFields({ value, onChange, disabled }: Props) {
  const set = (patch: Partial<PollDraftState>) => onChange({ ...value, ...patch })

  const setOption = (index: number, text: string) => {
    const options = [...value.options]
    options[index] = text
    set({ options })
  }

  const addOption = () => {
    if (value.options.length >= POLL_LIMITS.optionsMax) return
    set({ options: [...value.options, ""] })
  }

  const removeOption = (index: number) => {
    /* Ниже двух не опускаемся: опрос с одним вариантом это утверждение,
       и убрать поле, без которого форма не отправится, значит завести
       человека в тупик. */
    if (value.options.length <= POLL_LIMITS.optionsMin) return
    set({ options: value.options.filter((_, i) => i !== index) })
  }

  return (
    <Box>
      <Checkbox
        size="sm"
        label="Добавить опрос"
        checked={value.enabled}
        onChange={(event) => set({ enabled: event.currentTarget.checked })}
        disabled={disabled}
      />

      {value.enabled && (
        <Stack gap="xs" mt="xs" pl={26}>
          <TextInput
            label="Вопрос"
            placeholder="Например: какую модель взяли бы сейчас"
            value={value.question}
            onChange={(event) => set({ question: event.currentTarget.value })}
            maxLength={POLL_LIMITS.questionMax}
            size="sm"
            disabled={disabled}
          />

          <Box>
            <Text size="sm" fw={500} mb={4}>Варианты</Text>
            <Stack gap={6}>
              {value.options.map((option, index) => (
                <Group key={index} gap={6} wrap="nowrap">
                  <TextInput
                    placeholder={`Вариант ${index + 1}`}
                    value={option}
                    onChange={(event) => setOption(index, event.currentTarget.value)}
                    maxLength={POLL_LIMITS.optionMax}
                    size="sm"
                    style={{ flex: 1 }}
                    disabled={disabled}
                  />
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => removeOption(index)}
                    disabled={disabled || value.options.length <= POLL_LIMITS.optionsMin}
                    aria-label={`Убрать вариант ${index + 1}`}
                  >
                    <IconX size={15} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>

            {value.options.length < POLL_LIMITS.optionsMax && (
              <Button
                variant="subtle"
                size="compact-sm"
                color="gray"
                mt={6}
                leftSection={<IconPlus size={14} />}
                onClick={addOption}
                disabled={disabled}
              >
                Ещё вариант
              </Button>
            )}
          </Box>

          <Group gap="md" align="flex-end" wrap="wrap">
            <Checkbox
              size="sm"
              label="Можно выбрать несколько"
              checked={value.multiple}
              onChange={(event) => set({ multiple: event.currentTarget.checked })}
              disabled={disabled}
            />
            <Select
              label="Голосование идёт"
              placeholder="без ограничения"
              data={DURATIONS}
              value={value.closesInDays}
              onChange={(next) => set({ closesInDays: next })}
              clearable
              size="sm"
              w={170}
              disabled={disabled}
            />
          </Group>
        </Stack>
      )}
    </Box>
  )
}
