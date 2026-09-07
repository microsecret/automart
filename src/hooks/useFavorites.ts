"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { notifications } from "@mantine/notifications"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import { fetchJson } from "@/lib/api-client"

interface FavoriteIdsResponse {
  ids: string[]
  count: number
}

const FAVORITES_KEY = "/api/favorites?idsOnly=true"

/* Избранное гостя до входа.

   Раньше сердечко работало только для вошедших: гость нажимал, его уводило
   на вход, а после входа избранное оказывалось пустым — отмеченные машины
   пропадали. Рядом на той же карточке кнопка сравнения так не делала:
   она хранит список локально и переживает и вход, и перезагрузку.

   Теперь избранное ведёт себя так же. Отметки гостя копятся в браузере и
   при первом входе переносятся на его учётную запись. */
const GUEST_FAVORITES_KEY = "lewheel:guest-favorites"

function readGuestFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(GUEST_FAVORITES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []
  } catch {
    /* Приватное окно или запрет на хранилище: избранное просто не
       запомнится, но нажатие не должно падать с ошибкой. */
    return []
  }
}

function writeGuestFavorites(ids: string[]) {
  try {
    window.localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(ids))
    /* Соседние карточки на той же странице должны перекраситься сразу —
       так же, как это сделано у сравнения. */
    window.dispatchEvent(new Event("guest-favorites-changed"))
  } catch {
    /* см. выше */
  }
}

function errorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error
    if (typeof error === "string" && error.trim()) return error
  }

  return "Не удалось обновить избранное. Попробуйте ещё раз."
}

/**
 * A shared SWR cache for favorite IDs. Catalog cards can use this hook freely:
 * SWR de-duplicates the request, while mutations update every heart instantly.
 */
export function useFavorites() {
  const { status } = useSession()
  const isAuthenticated = status === "authenticated"
  const { data, isLoading, mutate } = useSWR<FavoriteIdsResponse>(
    isAuthenticated ? FAVORITES_KEY : null,
    fetchJson,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  )
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  const [guestIds, setGuestIds] = useState<string[]>([])

  /* Отметки гостя читаются после первой отрисовки: на сервере хранилища
     нет, и решение, принятое там, разошлось бы с браузером. */
  useEffect(() => {
    if (isAuthenticated) return
    const sync = () => setGuestIds(readGuestFavorites())
    sync()
    window.addEventListener("guest-favorites-changed", sync)
    return () => window.removeEventListener("guest-favorites-changed", sync)
  }, [isAuthenticated])

  /* Перенос при входе: то, что гость отметил до регистрации, становится
     его избранным. Иначе он проделывал бы отбор заново — а именно ради
     сохранённых машин он чаще всего и заводит учётную запись. */
  useEffect(() => {
    if (!isAuthenticated) return
    const pending = readGuestFavorites()
    if (pending.length === 0) return

    let cancelled = false
    ;(async () => {
      for (const listingId of pending) {
        try {
          await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listingId }),
          })
        } catch {
          /* Объявление могли снять, пока человек регистрировался, — такие
             просто пропускаем: показывать ошибку не за что. */
        }
      }
      if (cancelled) return
      writeGuestFavorites([])
      setGuestIds([])
      await mutate()
      notifications.show({
        title: "Избранное перенесено",
        message: `Машины, отмеченные до входа: ${pending.length}. Они уже в вашем избранном.`,
        color: "teal",
      })
    })()

    return () => { cancelled = true }
  }, [isAuthenticated, mutate])

  const favoriteIds = useMemo(
    () => new Set(isAuthenticated ? data?.ids ?? [] : guestIds),
    [data?.ids, guestIds, isAuthenticated],
  )

  const toggleFavorite = useCallback(async (listingId: string) => {
    if (pendingIds.has(listingId)) return false

    /* Гость отмечает в браузере: список переедет к нему при первом входе. */
    if (!isAuthenticated) {
      const current = readGuestFavorites()
      const next = current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId]
      writeGuestFavorites(next)
      setGuestIds(next)
      return true
    }

    const wasFavorite = favoriteIds.has(listingId)
    setPendingIds((current) => new Set(current).add(listingId))

    await mutate((current) => {
      const currentIds = current?.ids ?? []
      const ids = wasFavorite
        ? currentIds.filter((id) => id !== listingId)
        : [...new Set([...currentIds, listingId])]

      return { ids, count: ids.length }
    }, { revalidate: false })

    try {
      const response = await fetch(
        wasFavorite
          ? `/api/favorites?listingId=${encodeURIComponent(listingId)}`
          : "/api/favorites",
        {
          method: wasFavorite ? "DELETE" : "POST",
          headers: wasFavorite ? undefined : { "Content-Type": "application/json" },
          body: wasFavorite ? undefined : JSON.stringify({ listingId }),
        },
      )
      const payload = await response.json().catch(() => null)

      if (!response.ok) throw new Error(errorMessage(payload))

      await mutate()
      return true
    } catch (error) {
      await mutate()
      notifications.show({
        title: "Избранное не обновлено",
        message: error instanceof Error ? error.message : "Повторите попытку.",
        color: "red",
      })
      return false
    } finally {
      setPendingIds((current) => {
        const next = new Set(current)
        next.delete(listingId)
        return next
      })
    }
  }, [favoriteIds, isAuthenticated, mutate, pendingIds])

  return {
    favoriteIds,
    isAuthenticated,
    isLoading: isAuthenticated && isLoading,
    isPending: (listingId: string) => pendingIds.has(listingId),
    toggleFavorite,
  }
}
