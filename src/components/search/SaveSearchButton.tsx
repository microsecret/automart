"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Alert, Button, Modal, Stack, Text, TextInput, Switch } from "@mantine/core"
import { IconBell, IconBellPlus, IconCircleCheck } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { normalizeSavedSearchQuery } from "@/lib/saved-search"
import { savedSearchSummary } from "@/lib/saved-search-summary.mjs"
import styles from "./SaveSearchButton.module.css"

type Props = {
  /** Раздел: объявления площадки или импортные аукционы. */
  scope: "LISTINGS" | "AUCTIONS" | "PARTS"
  /** Подсказка для названия — обычно то, что человек искал. */
  suggestedTitle?: string
}

/**
 * Подписка на текущий поиск.
 *
 * Машину редко покупают в первый визит: человек присматривается неделями.
 * Кнопка предлагает не возвращаться самому, а получить сообщение, когда
 * появится подходящий вариант.
 */
/**
 * Обёртка с Suspense.
 *
 * Внутри используется useSearchParams: без границы Suspense Next.js не может
 * отрисовать страницу заранее и роняет сборку целиком — главная переставала
 * собираться, а сайт возвращал 502.
 */
export default function SaveSearchButton(props: Props) {
  return (
    <Suspense fallback={null}>
      <SaveSearchButtonInner {...props} />
    </Suspense>
  )
}

function SaveSearchButtonInner({ scope, suggestedTitle }: Props) {
  const { data: session } = useSession()
  const params = useSearchParams()
  const [opened, setOpened] = useState(false)
  const [title, setTitle] = useState("")
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [saved, setSaved] = useState<{ alreadySaved: boolean; notifyTelegram: boolean } | null>(null)
  const savingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const successRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (saved) successRef.current?.focus() }, [saved])

  /* Гостю показываем вход, а не пустоту.

     Уведомления уходят в Telegram, привязанный к аккаунту, поэтому без
     входа подписаться нельзя. Но раньше компонент просто исчезал — и
     человек видел приглашение «Следить за этим поиском» без единой кнопки
     рядом. Теперь предложение ведёт туда, где его можно принять. */
  if (!session?.user) {
    return (
      <Button
        component={Link}
        href={`/auth/signin?callbackUrl=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname + window.location.search)}`}
        variant="light"
        color="indigo"
        size="compact-sm"
        leftSection={<IconBellPlus size={15} aria-hidden="true" />}
      >
        {scope === "PARTS" ? "Войти и подписаться" : "Войти и следить"}
      </Button>
    )
  }

  const openDialog = () => {
    const current = normalizeSavedSearchQuery(window.location.search || params?.toString() || "", scope)
    setQuery(current)
    setError("")
    setSaved(null)
    setTitle(suggestedTitle?.trim() || defaultTitle(current, scope))
    setOpened(true)
  }

  const save = async () => {
    if (savingRef.current) return
    if (!title.trim()) {
      setError("Введите название подписки")
      inputRef.current?.focus()
      return
    }
    savingRef.current = true
    setError("")
    setSaving(true)
    try {
      const result = await fetchJson<{ alreadySaved?: boolean; notifyTelegram: boolean }>("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), scope, query, notifyTelegram: notify }),
      })
      setSaved({ alreadySaved: result.alreadySaved === true, notifyTelegram: result.notifyTelegram })
    } catch (error) {
      setError(getApiClientErrorMessage(error, "Не удалось сохранить. Попробуйте ещё раз."))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="light"
        color="indigo"
        size="compact-sm"
        leftSection={<IconBellPlus size={15} aria-hidden="true" />}
        onClick={openDialog}
      >
        {scope === "PARTS" ? "Сообщить о поступлении" : "Следить за поиском"}
      </Button>

      <Modal opened={opened} onClose={() => { if (!savingRef.current) setOpened(false) }} title={scope === "PARTS" ? "Сообщить о поступлении" : "Следить за поиском"} radius="md" size={520} zIndex={600} centered transitionProps={{ transition: "fade", duration: 0 }}>
        {saved ? (
          <Stack gap="md" className={styles.success} role="status" aria-live="polite">
            <IconCircleCheck size={42} className={styles.successIcon} aria-hidden="true" />
            <Text component="h2" fz="lg" fw={700} m={0} tabIndex={-1} ref={successRef}>
              {saved.alreadySaved ? "Этот поиск уже сохранён" : "Поиск сохранён"}
            </Text>
            <Text size="sm">{saved.alreadySaved
              ? "Повторная подписка не создана. Название и настройки прежнего поиска сохранены."
              : saved.notifyTelegram ? "Сообщим о новых подходящих предложениях. Если Telegram не привязан, уведомление появится на сайте." : "Поиск доступен в кабинете без уведомлений в Telegram."}</Text>
            <Button component={Link} href="/dashboard?tab=subscriptions" fullWidth>Мои подписки</Button>
            <Button variant="subtle" onClick={() => setOpened(false)}>Вернуться к каталогу</Button>
          </Stack>
        ) : (
        <form onSubmit={(event) => { event.preventDefault(); void save() }}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {scope === "PARTS"
              ? "Сохраним раздел и фильтры и сообщим, когда магазины выложат подходящие товары: в Telegram, а если он не привязан — в уведомлениях на сайте."
              : "Сохраним ваши фильтры и сообщим, когда появятся новые подходящие варианты — не придётся возвращаться и проверять каталог вручную."}
          </Text>

          <section className={styles.summary} aria-label="Условия подписки">
            <Text fw={600} size="sm">Вы выбрали</Text>
            <ul className={styles.facets}>
              {savedSearchSummary(query).length ? savedSearchSummary(query).map((item) => (
                <li key={item.label}><Text component="span" size="sm" c="dimmed">{item.label}: </Text>{item.value}</li>
              )) : <li>{query ? "Фильтры текущего поиска" : "Все предложения выбранного раздела"}</li>}
            </ul>
            <Text size="xs" mt={8}>Сохраним все применённые фильтры. Чтобы изменить условия, вернитесь в каталог.</Text>
          </section>

          <details className={styles.tutorial}>
            <summary>Как работают подписки</summary>
            <ol className={styles.steps}>
              <li>Настройте фильтры в каталоге под свой запрос.</li>
              <li>Дайте поиску название и сохраните его.</li>
              <li>Получайте новые предложения и управляйте поиском в кабинете.</li>
            </ol>
          </details>

          <TextInput
            ref={inputRef}
            name="savedSearchTitle"
            autoComplete="off"
            label="Название подписки"
            description="Чтобы отличать её от других в кабинете"
            value={title}
            onChange={(event) => { setTitle(event.currentTarget.value); if (error) setError("") }}
            maxLength={120}
            disabled={saving}
          />

          <Switch
            name="notifyTelegram"
            disabled={saving}
            checked={notify}
            onChange={(event) => setNotify(event.currentTarget.checked)}
            label="Присылать уведомления в Telegram"
            description="Не чаще пяти сообщений в сутки"
          />

          {error && <Alert color="red" role="alert">{error}</Alert>}

          <Button
            type="submit"
            leftSection={<IconBell size={16} aria-hidden="true" />}
            loading={saving}
            fullWidth
          >
            {saving ? "Сохраняем…" : "Сохранить подписку"}
          </Button>
        </Stack>
        </form>
        )}
      </Modal>
    </>
  )
}

/**
 * Название по умолчанию из самих фильтров: пустое поле человек чаще всего
 * закрывает, а не заполняет.
 */
function defaultTitle(query: string, scope: Props["scope"]) {
  const params = new URLSearchParams(query)
  const parts = [params.get("make"), params.get("model")].filter(Boolean)
  if (parts.length > 0) return parts.join(" ")

  const search = params.get("q")?.trim()
  if (search) return search

  if (scope === "PARTS") return "Запчасти: мой поиск"
  return scope === "AUCTIONS" ? "Аукционы: мой поиск" : "Объявления: мой поиск"
}
