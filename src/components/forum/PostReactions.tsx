"use client"

import { useState } from "react"
import { Badge, Button, Group, Tooltip } from "@mantine/core"
import { IconBulb, IconCheck, IconHeart } from "@tabler/icons-react"
import { REACTION_KINDS } from "@/lib/forum-reputation"

/**
 * Реакции под сообщением и отметка лучшего ответа.
 *
 * «Спасибо, помогло» пишут отдельным сообщением, и в теме о ремонте
 * половина ответов — благодарности, между которыми теряется суть.
 *
 * Цифры меняются на месте, без перезагрузки страницы: реакция это
 * мелкое действие, и ждать после него перерисовку темы неуместно.
 */

const ICONS = { IconBulb, IconHeart, IconCheck } as const

type Props = {
  postId: string
  counts: Record<string, number>
  mine: string[]
  canReact: boolean
  isBestAnswer: boolean
  canMarkBest: boolean
}

export default function PostReactions({
  postId,
  counts: initialCounts,
  mine: initialMine,
  canReact,
  isBestAnswer: initialBest,
  canMarkBest,
}: Props) {
  const [counts, setCounts] = useState(initialCounts)
  const [mine, setMine] = useState(initialMine)
  const [best, setBest] = useState(initialBest)
  const [busy, setBusy] = useState<string | null>(null)

  const react = async (kind: string) => {
    if (!canReact || busy) return
    setBusy(kind)

    /* Цифра меняется сразу, до ответа сервера: реакция — мелкое
       действие, и задержка в полсекунды на нажатие читается как
       поломка. При отказе значение возвращается. */
    const wasMine = mine.includes(kind)
    const delta = wasMine ? -1 : 1
    setCounts((current) => ({ ...current, [kind]: Math.max(0, (current[kind] || 0) + delta) }))
    setMine((current) => (wasMine ? current.filter((item) => item !== kind) : [...current, kind]))

    try {
      const response = await fetch("/api/forum/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, kind }),
      })
      if (!response.ok) throw new Error("отказ")
    } catch {
      setCounts((current) => ({ ...current, [kind]: Math.max(0, (current[kind] || 0) - delta) }))
      setMine((current) => (wasMine ? [...current, kind] : current.filter((item) => item !== kind)))
    } finally {
      setBusy(null)
    }
  }

  const markBest = async () => {
    if (!canMarkBest || busy) return
    setBusy("best")
    const previous = best
    setBest(!previous)
    try {
      const response = await fetch("/api/forum/best-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      })
      if (!response.ok) throw new Error("отказ")
    } catch {
      setBest(previous)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Group gap={4} mt={6} wrap="wrap">
      {REACTION_KINDS.map(({ kind, label, icon }) => {
        const Icon = ICONS[icon as keyof typeof ICONS]
        const count = counts[kind] || 0
        const active = mine.includes(kind)

        /* Реакция без единого голоса показывается только тому, кто может
           её поставить: гостю ряд пустых значков ничего не говорит. */
        if (count === 0 && !canReact) return null

        return (
          <Tooltip key={kind} label={canReact ? label : `${label}: ${count}`} withArrow>
            <Button
              variant={active ? "light" : "subtle"}
              color={active ? "indigo" : "gray"}
              size="compact-xs"
              px={7}
              className="forum-reaction"
              data-active={active ? "true" : undefined}
              onClick={() => void react(kind)}
              disabled={!canReact || busy !== null}
              aria-label={label}
              aria-pressed={active}
              leftSection={<Icon size={13} />}
            >
              {count > 0 ? count : ""}
            </Button>
          </Tooltip>
        )
      })}

      {best && (
        <Badge size="sm" variant="light" color="teal" leftSection={<IconCheck size={12} />}>
          Решило вопрос
        </Badge>
      )}

      {canMarkBest && (
        <Button
          variant="subtle"
          color={best ? "gray" : "teal"}
          size="compact-xs"
          onClick={() => void markBest()}
          disabled={busy !== null}
        >
          {best ? "Снять отметку" : "Это решило вопрос"}
        </Button>
      )}
    </Group>
  )
}
