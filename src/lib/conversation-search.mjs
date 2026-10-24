export const MAX_CONVERSATION_QUERY_LENGTH = 120

/** Literal substring search with one-character case pairs (including Cyrillic).
 * SQLite LIKE/LOWER do not fold Cyrillic. Bound GLOB parameters avoid both
 * wildcard interpretation of user input and an unbounded JS mailbox scan. */
export function conversationSearchGlob(value) {
  const query = String(value || "").trim().normalize("NFC")
  if (query.length > MAX_CONVERSATION_QUERY_LENGTH) throw new RangeError("Conversation search is too long")
  if (!query) return null
  const escaped = [...query].map((character) => {
    if (character === "*") return "[*]"
    if (character === "?") return "[?]"
    if (character === "[") return "[[]"
    const lower = character.toLowerCase(), upper = character.toUpperCase()
    return lower !== upper && [...lower].length === 1 && [...upper].length === 1 ? `[${lower}${upper}]` : character
  }).join("")
  return `*${escaped}*`
}
