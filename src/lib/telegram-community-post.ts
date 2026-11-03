/** Only links returned by getChat for the destination chat are accepted. */
export function communityChatUrl(chat: { username?: string; invite_link?: string }): string | null {
  if (chat.username && /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(chat.username)) return `https://t.me/${chat.username}`
  const invite = chat.invite_link
  return invite && /^https:\/\/t\.me\/(?:\+[A-Za-z0-9_-]+|joinchat\/[A-Za-z0-9_-]+)$/.test(invite) ? invite : null
}

export function communityIntervalMs(override?: string): number {
  const configured = Number(override)
  const minimum = 6 * 60 * 60 * 1000
  return Number.isFinite(configured) && configured >= minimum ? configured : minimum
}

export function buildCommunityPost(input: { title?: string | null; chatUrl: string; siteUrl: string; botUsername?: string | null }) {
  let title = ""
  for (const point of input.title || "Наш автомобильный чат") {
    const safe = point.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    if (title.length + safe.length > 120) { title += "…"; break }
    title += safe
  }
  const text = [
    `🚘 <b>${title} — больше полезных связей для автомобилистов</b>`, "",
    "Продаёте автомобиль, ищете запчасть или хотите спросить совета? Расскажите о нашем чате знакомым.", "",
    "🤝 Пригласите друга — вместе проще найти покупателя, нужную деталь и опытного собеседника.",
    "📝 Объявления в чате можно размещать бесплатно после авторизации в боте.", "",
    "<b>Нажмите «Рассказать другу»</b> и отправьте приглашение тому, кому пригодится именно этот чат.",
  ].join("\n")
  const keyboard = { inline_keyboard: [
    [{ text: "🤝 Рассказать другу", url: `https://t.me/share/url?url=${encodeURIComponent(input.chatUrl)}&text=${encodeURIComponent("Присоединяйтесь к нашему автомобильному чату: объявления, запчасти и общение.")}` }],
    [{ text: "🚘 Открыть наш чат", url: input.chatUrl }],
    ...(input.botUsername ? [[{ text: "✅ Пройти авторизацию", url: `https://t.me/${input.botUsername}?start=community` }]] : []),
    [{ text: "🌐 Перейти на LeWheel", url: input.siteUrl }],
  ] }
  return { text, keyboard }
}
