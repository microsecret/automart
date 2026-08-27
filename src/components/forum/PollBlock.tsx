"use client"

import { useState } from "react"
import { Badge, Box, Button, Checkbox, Group, Radio, Stack, Text } from "@mantine/core"
import { IconChartBar } from "@tabler/icons-react"
import { isPollClosed, pluralVotes, pollShares } from "@/lib/forum-poll"

/**
 * Опрос в теме форума.
 *
 * До голоса показывает варианты для выбора, после — полосы с долями.
 * Разделение важное: видимые проценты до голосования тянут отметить то,
 * что уже выбрало большинство, и опрос перестаёт что-либо измерять.
 *
 * Итог виден и тем, кто не голосовал: закрытый опрос или уже отданный
 * голос показывают цифры сразу.
 */

export type PollOption = {
  id: string
  text: string
  votes: number
}

export type PollData = {
  id: string
  question: string
  multiple: boolean
  closesAt: string | null
  options: PollOption[]
  /* Варианты, за которые человек уже отдал голос. Пустой список у гостя
     и у того, кто ещё не голосовал. */
  myVotes: string[]
}

type Props = {
  poll: PollData
  canVote: boolean
}

export default function PollBlock({ poll, canVote }: Props) {
  const [options, setOptions] = useState(poll.options)
  const [myVotes, setMyVotes] = useState(poll.myVotes)
  const [selected, setSelected] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const closed = isPollClosed({ closesAt: poll.closesAt ? new Date(poll.closesAt) : null })
  const voted = myVotes.length > 0
  const showResults = voted || closed
  const total = options.reduce((sum, option) => sum + option.votes, 0)
  const shares = pollShares(options)

  const toggle = (optionId: string) => {
    setError(null)
    setSelected((current) => {
      if (!poll.multiple) return [optionId]
      return current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
    })
  }

  const vote = async () => {
    if (selected.length === 0) {
      setError("Выберите вариант")
      return
    }
    setSending(true)
    setError(null)
    try {
      const response = await fetch("/api/forum/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, optionIds: selected }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || "Не удалось записать голос")
        return
      }
      /* Свежие цифры приходят вместе с ответом: перезапрашивать тему
         целиком ради результата, который сам же и изменил, незачем. */
      if (Array.isArray(data?.options)) setOptions(data.options)
      setMyVotes(selected)
    } catch {
      setError("Не удалось записать голос")
    } finally {
      setSending(false)
    }
  }

  return (
    <Box className="forum-poll">
      <Group gap={6} mb={6} wrap="nowrap">
        <IconChartBar size={16} className="forum-poll__icon" />
        <Text fw={600} size="sm" style={{ flex: 1 }}>{poll.question}</Text>
        {closed && <Badge size="xs" variant="light" color="gray">Завершён</Badge>}
      </Group>

      {showResults ? (
        <Stack gap={6}>
          {options.map((option) => {
            const share = shares.get(option.id) ?? 0
            const mine = myVotes.includes(option.id)
            return (
              <Box key={option.id} className="forum-poll__result" data-mine={mine ? "true" : undefined}>
                <Group justify="space-between" gap="xs" mb={2} wrap="nowrap">
                  <Text size="sm" style={{ flex: 1 }}>{option.text}</Text>
                  <Text size="xs" c="var(--market-muted)" fw={600}>{share}%</Text>
                </Group>
                {/* Ширина полосы — единственное, что здесь меняется:
                    остальное остаётся на месте, чтобы результат не
                    перестраивал страницу при обновлении цифр. */}
                <Box className="forum-poll__track">
                  <Box className="forum-poll__bar" style={{ width: `${share}%` }} />
                </Box>
                <Text size="xs" c="var(--market-muted)" mt={2}>{pluralVotes(option.votes)}</Text>
              </Box>
            )
          })}
        </Stack>
      ) : (
        <Stack gap={4}>
          {options.map((option) => (
            poll.multiple ? (
              <Checkbox
                key={option.id}
                size="sm"
                label={option.text}
                checked={selected.includes(option.id)}
                onChange={() => toggle(option.id)}
                disabled={!canVote || sending}
              />
            ) : (
              <Radio
                key={option.id}
                size="sm"
                label={option.text}
                checked={selected.includes(option.id)}
                onChange={() => toggle(option.id)}
                disabled={!canVote || sending}
              />
            )
          ))}
        </Stack>
      )}

      {error && <Text size="xs" c="red" mt={6} role="alert">{error}</Text>}

      <Group justify="space-between" mt={8} gap="xs" wrap="wrap">
        <Text size="xs" c="var(--market-muted)">
          {pluralVotes(total)}
          {poll.multiple && !showResults && " · можно выбрать несколько"}
        </Text>

        {!showResults && (
          canVote ? (
            <Button size="compact-sm" onClick={vote} loading={sending}>Голосовать</Button>
          ) : (
            <Text size="xs" c="var(--market-muted)">Войдите, чтобы голосовать</Text>
          )
        )}
      </Group>
    </Box>
  )
}
