"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Button, Group, Stack, Text, Tooltip } from "@mantine/core"
import { IconBulb, IconCheck, IconHeart, IconPencil, IconQuote } from "@tabler/icons-react"
import { REACTION_KINDS } from "@/lib/forum-reputation"
import { requestQuote } from "@/lib/forum-quote"
import MarkupEditor from "@/components/forum/MarkupEditor"
import { validatePostContent } from "@/lib/forum"

/**
 * Действия под сообщением: реакции, цитата, правка, отметка ответа.
 *
 * Всё в одном ряду намеренно: разнеси их по углам карточки — и человек
 * будет искать нужное глазами вместо того, чтобы читать разговор.
 */

const ICONS = { IconBulb, IconHeart, IconCheck } as const

type Props = {
  postId: string
  authorName: string
  /** Исходный текст сообщения: нужен и цитате, и правке. */
  rawContent: string
  /** Текст без разметки — его и цитируем. */
  plainContent: string
  counts: Record<string, number>
  mine: string[]
  canReact: boolean
  canQuote: boolean
  canEdit: boolean
  editedAt: string | null
  isBestAnswer: boolean
  canMarkBest: boolean
}

export default function PostActions({
  postId,
  authorName,
  rawContent,
  plainContent,
  counts: initialCounts,
  mine: initialMine,
  canReact,
  canQuote,
  canEdit,
  editedAt,
  isBestAnswer: initialBest,
  canMarkBest,
}: Props) {
  const router = useRouter()
  const [counts, setCounts] = useState(initialCounts)
  const [mine, setMine] = useState(initialMine)
  const [best, setBest] = useState(initialBest)
  const [busy, setBusy] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rawContent)
  const [editError, setEditError] = useState<string | null>(null)

  const react = async (kind: string) => {
    if (!canReact || busy) return
    setBusy(kind)

    /* Цифра меняется сразу, до ответа сервера: реакция — мелкое
       действие, и задержка в полсекунды читается как поломка. При отказе
       значение возвращается. */
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
      /* Отметка одна на тему: прежняя снялась на сервере, и увидеть это
         можно только перечитав страницу. */
      router.refresh()
    } catch {
      setBest(previous)
    } finally {
      setBusy(null)
    }
  }

  const saveEdit = async () => {
    const error = validatePostContent(draft)
    if (error) {
      setEditError(error)
      return
    }
    setBusy("edit")
    setEditError(null)
    try {
      const response = await fetch("/api/forum/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content: draft.trim() }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось сохранить")
      setEditing(false)
      router.refresh()
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : "Не удалось сохранить")
    } finally {
      setBusy(null)
    }
  }

  if (editing) {
    return (
      <Stack gap="xs" mt={8}>
        <MarkupEditor
          label="Правка сообщения"
          value={draft}
          onChange={setDraft}
          minRows={3}
          disabled={busy === "edit"}
        />
        {editError && <Text size="xs" c="red.6">{editError}</Text>}
        <Group gap="xs">
          <Button size="compact-sm" color="indigo" loading={busy === "edit"} onClick={() => void saveEdit()}>
            Сохранить
          </Button>
          <Button
            size="compact-sm"
            variant="subtle"
            color="gray"
            onClick={() => { setEditing(false); setDraft(rawContent); setEditError(null) }}
            disabled={busy === "edit"}
          >
            Отмена
          </Button>
        </Group>
      </Stack>
    )
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

      {canQuote && (
        <Button
          variant="subtle"
          color="gray"
          size="compact-xs"
          px={7}
          className="forum-reaction"
          leftSection={<IconQuote size={13} />}
          onClick={() => requestQuote({ author: authorName, text: plainContent })}
          disabled={busy !== null}
        >
          Цитировать
        </Button>
      )}

      {canEdit && (
        <Button
          variant="subtle"
          color="gray"
          size="compact-xs"
          px={7}
          className="forum-reaction"
          leftSection={<IconPencil size={13} />}
          onClick={() => setEditing(true)}
          disabled={busy !== null}
        >
          Править
        </Button>
      )}

      {/* Метка правки: читатель должен видеть, что текст менялся после
          того, как ему ответили. */}
      {editedAt && (
        <Text fz={11} c="var(--market-muted)" title={`Изменено ${editedAt}`}>изменено</Text>
      )}

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
