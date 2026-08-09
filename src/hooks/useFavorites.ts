"use client"

import { useCallback, useMemo, useState } from "react"
import { notifications } from "@mantine/notifications"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import { fetchJson } from "@/lib/api-client"

interface FavoriteIdsResponse {
  ids: string[]
  count: number
}

const FAVORITES_KEY = "/api/favorites?idsOnly=true"

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
  const favoriteIds = useMemo(() => new Set(data?.ids ?? []), [data?.ids])

  const toggleFavorite = useCallback(async (listingId: string) => {
    if (!isAuthenticated || pendingIds.has(listingId)) return false

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
