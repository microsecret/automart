export const MAX_MESSAGE_LENGTH = 4_000

/** Keeps whitespace predictable and prevents oversized payloads in all chat entry points. */
export function normalizeMessageContent(value: unknown): string | null {
  if (typeof value !== "string") return null
  const content = value.trim()
  return content.length > 0 && content.length <= MAX_MESSAGE_LENGTH ? content : null
}

/** Conversation ids are opaque to clients; the server always creates them in this stable order. */
export function createConversationId(firstUserId: string, secondUserId: string, listingId?: string | null) {
  const [first, second] = [firstUserId, secondUserId].sort()
  return `${first}-${second}-${listingId || "no-listing"}`
}
