export class ApiClientError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = "ApiClientError"
    this.status = status
    this.payload = payload
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error
    if (typeof message === "string" && message.trim()) return message
  }

  return fallback
}

/**
 * SWR fetcher for browser API routes. Unlike `response.json()` directly, it
 * preserves the HTTP status and lets the UI render a recovery state for 4xx/5xx.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiClientError(
      getErrorMessage(payload, `Не удалось получить данные (${response.status})`),
      response.status,
      payload,
    )
  }

  return payload as T
}
