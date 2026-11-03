/** Group notice wording only; account completion rules remain unchanged. */
export function moderationAuthorizationText(userMention: string, step: string): string {
  const remaining = step === "contact"
    ? ["📲 Подтвердите свой телефон кнопкой Telegram.", "📧 Укажите почту для входа.", "🔑 Задайте пароль от аккаунта."]
    : step === "email"
      ? ["📧 Укажите почту для входа.", "🔑 Задайте пароль от аккаунта."]
      : step === "password" ? ["🔑 Задайте пароль от аккаунта."] : []
  return [
    `🗑 <b>${userMention}, ваше сообщение удалено</b>`, "",
    "Чтобы бесплатно размещать объявления в чате, пройдите <b>авторизацию в боте</b>.",
    ...remaining, "",
    "✅ После авторизации вы сможете снова бесплатно размещать свои объявления.",
    "⏳ Это уведомление исчезнет через 5 минут.",
  ].join("\n")
}

/** Share the existing public chat; never manufacture private invite links. */
export function moderationShareUrl(chatUsername?: string, botUsername?: string): string | null {
  const valid = (value?: string) => {
    const name = value?.trim().replace(/^@/, "")
    return name && /^[A-Za-z0-9_]{5,32}$/.test(name) ? name : null
  }
  const chat = valid(chatUsername)
  const bot = valid(botUsername)
  if (!chat && !bot) return null
  const url = `https://t.me/${chat || bot}`
  const text = chat ? "Присоединяйтесь к автомобильному чату LeWheel" : "LeWheel — автомобили, запчасти и услуги"
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
}
