const DELETE_WINDOW_MS = 48 * 60 * 60_000

function floodDelayMs(message) {
  const seconds = Number(/\bretry after (\d+)\b/iu.exec(message)?.[1])
  if (Number.isSafeInteger(seconds) && seconds > 0) return Math.min(seconds * 1000, DELETE_WINDOW_MS)
  return /\btoo many requests\b|\bTelegram API 429\b/iu.test(message) ? 30_000 : 0
}

// Durable claim/retry policy. Dependencies are injected for network-free regression tests.
export async function runTelegramCleanup({ store, api, now = Date.now, cooldown }, limit = 50) {
  if (cooldown?.until > now()) return { checked: 0, deleted: 0, failed: 0, expired: 0 }
  const due = await store.findMany({ where: { processedAt: null, deleteAt: { lte: new Date(now()) } }, orderBy: { deleteAt: "asc" }, take: Math.max(1, Math.min(limit, 100)) })
  let deleted = 0, failed = 0, expired = 0
  for (const item of due) {
    const attempts = item.attempts + 1
    const lease = new Date(now() + 5 * 60_000)
    const claim = await store.updateMany({ where: { id: item.id, processedAt: null, attempts: item.attempts, deleteAt: item.deleteAt }, data: { attempts, deleteAt: lease } })
    if (!claim.count) continue
    const where = { id: item.id, processedAt: null, attempts, deleteAt: lease }
    if (now() - new Date(item.createdAt).getTime() >= DELETE_WINDOW_MS) {
      await store.updateMany({ where, data: { processedAt: new Date(now()), lastError: "Telegram: истёк 48-часовой срок удаления" } })
      expired += 1
      continue
    }
    try {
      await api("deleteMessage", { chat_id: item.chatId, message_id: item.messageId })
      await store.updateMany({ where, data: { processedAt: new Date(now()), lastError: null } })
      deleted += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Already gone is success; permission/network errors can recover before Telegram's deadline.
      const missing = /message to delete not found/iu.test(message)
      const floodDelay = floodDelayMs(message)
      const failureTime = now()
      const retryAt = new Date(failureTime + Math.max(floodDelay, Math.min(15 * 60_000, attempts * 30_000)))
      if (cooldown && floodDelay > 0) cooldown.until = failureTime + floodDelay
      await store.updateMany({ where, data: { processedAt: missing ? new Date(now()) : null,
        lastError: missing ? null : message.slice(0, 500),
        deleteAt: retryAt } })
      if (missing) deleted += 1
      else failed += 1
      if (floodDelay > 0) break
    }
  }
  return { checked: due.length, deleted, failed, expired }
}
