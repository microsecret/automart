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
      await deps.forget(chatId, String(memberBot.id))
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
  for (const bot of targets) {
    const botId = String(bot.id)
    if (botId === deps.ownBotId) continue
    // Check live target role first: never attempt to ban a chat administrator.
    const target = await deps.api("getChatMember", { chat_id: chatId, user_id: botId })
    if (admins.has(target.status)) continue
    if (!present(target)) continue // Late/duplicate update after removal.
    const own = await deps.api("getChatMember", { chat_id: chatId, user_id: deps.ownBotId })
    if (!admins.has(own.status) || own.can_restrict_members !== true) {
      deps.warn("missing can_restrict_members", chatId)
      continue
    }
    // Do not unban afterwards: an ordinary member must not re-add the spam bot.
    await deps.api("banChatMember", { chat_id: chatId, user_id: botId, revoke_messages: true })
    await deps.forget(chatId, botId)
    if (message?.message_id && own.can_delete_messages === true) {
      await deps.api("deleteMessage", { chat_id: chatId, message_id: message.message_id }).catch(() => deps.warn("service/message cleanup failed", chatId))
    }
  }
  return true
}
