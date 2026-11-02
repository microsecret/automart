// Durable claim/retry policy. Dependencies are injected for network-free regression tests.
export async function runTelegramCleanup({ store, api, now = Date.now }, limit = 50) {
  const due = await store.findMany({ where: { processedAt: null, deleteAt: { lte: new Date(now()) } }, orderBy: { deleteAt: "asc" }, take: Math.max(1, Math.min(limit, 100)) })
  let deleted = 0, failed = 0, expired = 0
  for (const item of due) {
    const attempts = item.attempts + 1
    const lease = new Date(now() + 5 * 60_000)
    const claim = await store.updateMany({ where: { id: item.id, processedAt: null, attempts: item.attempts, deleteAt: item.deleteAt }, data: { attempts, deleteAt: lease } })
    if (!claim.count) continue
    const where = { id: item.id, processedAt: null, attempts, deleteAt: lease }
    if (now() - new Date(item.createdAt).getTime() >= 48 * 60 * 60_000) {
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
      await store.updateMany({ where, data: { processedAt: missing ? new Date(now()) : null,
        lastError: missing ? null : message.slice(0, 500),
        deleteAt: new Date(now() + Math.min(15 * 60_000, attempts * 30_000)) } })
      if (missing) deleted += 1
      else failed += 1
    }
  }
  return { checked: due.length, deleted, failed, expired }
}
