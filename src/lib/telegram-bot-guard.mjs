const admins = new Set(["creator", "owner", "administrator"])
const present = (member) => ["member", "administrator", "creator", "owner"].includes(member?.status) || (member?.status === "restricted" && member.is_member === true)

/** Administrator-role-only moderation. Transport is injected so
 * every destructive decision is testable without contacting Telegram. */
export async function guardTelegramBots(update, deps) {
  const membership = update?.chat_member
  const message = update?.message
  const chat = membership?.chat || message?.chat
  if (!chat || !["group", "supergroup"].includes(chat.type) || !deps.enabled(String(chat.id))) return false
  const chatId = String(chat.id)
  const memberBot = membership?.new_chat_member?.user
  if (membership) {
    if (!memberBot?.is_bot || String(memberBot.id) === deps.ownBotId) return false
    if (!present(membership.new_chat_member)) {
      await deps.forget(chatId, String(memberBot.id)).catch(() => deps.warn("historical approval cleanup failed", chatId))
      return true
    }
    // Re-check role changes as well: a demoted bot must leave immediately.
  }
  const joining = membership ? [memberBot] : (message?.new_chat_members || []).filter((user) => user.is_bot)
  const senderBot = message?.from?.is_bot ? message.from : null
  // Anonymous administrators speak on behalf of this group, not as a bot.
  if (!joining.length && String(message?.sender_chat?.id) === chatId) return false
  const targets = joining.length ? joining : senderBot ? [senderBot] : []
  if (!targets.length) return false
  // Only an actual addition identifies an inviter. Permission changes and
  // ordinary messages must never punish the actor who happened to emit them.
  const addition = membership
    ? ["left", "kicked"].includes(membership.old_chat_member?.status) && present(membership.new_chat_member)
    : joining.length > 0 && !message?.sender_chat
  const actor = addition ? (membership?.from || message?.from) : null
  const inviterId = actor?.is_bot === false && Number.isSafeInteger(actor.id) && actor.id > 0
    && String(actor.id) !== deps.ownBotId ? String(actor.id) : null
  let inviterChecked = false
  const seen = new Set()
  let ownMembership
  let messageDeleted = false
  for (const bot of targets) {
    const botId = String(bot.id)
    if (botId === deps.ownBotId || seen.has(botId)) continue
    seen.add(botId)
    try {
      // Always verify each target's live role. Never share this lookup between
      // bots or events: a legitimate bot may have just been promoted.
      const target = await deps.api("getChatMember", { chat_id: chatId, user_id: botId })
      if (admins.has(target.status)) continue
      if (!present(target)) continue // Late/duplicate update after removal.
      // Only share moderator capability within this event. A rejected promise
      // remains rejected, so an outage cannot trigger a retry storm or a ban.
      ownMembership ||= deps.api("getChatMember", { chat_id: chatId, user_id: deps.ownBotId })
      const own = await ownMembership
      if (!admins.has(own.status) || own.can_restrict_members !== true) {
        deps.warn("missing can_restrict_members", chatId)
        continue
      }
      // Do not unban afterwards: an ordinary member must not re-add the bot.
      await deps.api("banChatMember", { chat_id: chatId, user_id: botId, revoke_messages: true })
      if (inviterId && !inviterChecked) {
        inviterChecked = true
        try {
          const inviter = await deps.api("getChatMember", { chat_id: chatId, user_id: inviterId })
          if (present(inviter) && !admins.has(inviter.status)) {
            await deps.api("banChatMember", { chat_id: chatId, user_id: inviterId, revoke_messages: true })
          }
        } catch {
          // An unavailable actor role never authorizes a ban and must not
          // prevent cleanup of the bot or processing the rest of this batch.
          deps.warn("inviter role check or removal failed", chatId)
        }
      }
      // Obsolete approval cleanup must not prevent message cleanup after a ban.
      await deps.forget(chatId, botId).catch(() => deps.warn("historical approval cleanup failed", chatId))
      if (!messageDeleted && message?.message_id && own.can_delete_messages === true) {
        await deps.api("deleteMessage", { chat_id: chatId, message_id: message.message_id })
          .then(() => { messageDeleted = true })
          .catch(() => deps.warn("service/message cleanup failed", chatId))
      }
    } catch {
      // API error bodies can contain sensitive transport details. Log a fixed
      // diagnostic, keep this bot untouched, and process the remaining targets.
      deps.warn("bot role check or removal failed", chatId)
    }
  }
  return true
}
