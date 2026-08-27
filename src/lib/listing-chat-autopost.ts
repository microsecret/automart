/**
 * Объявление уходит в чат сразу после публикации.
 *
 * Раньше объявление попадало в чаты только через платное продвижение, то
 * есть почти никогда: человек размещал машину и ждал звонков от тех, кто
 * сам зайдёт на сайт.
 *
 * Бесплатно объявление уходит в один чат — тот, откуда пришёл сам
 * продавец. Его увидят те, среди кого он уже состоит: для чата под
 * Владивосток это разница между «продаю Prado» среди своих и тем же
 * объявлением среди всей страны.
 *
 * Платное продвижение остаётся тем, чем было: все чаты сети, закреп и
 * повторные размещения — за это и платят.
 */

import { prisma } from "@/lib/prisma"
import { telegramApi, getTelegramBotUsername } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import { buildChatPost, type PromotedListing } from "@/lib/chat-promotion-post"

/**
 * Запоминает, что человек пишет в этом чате.
 *
 * Вызывается из вебхука при каждом сообщении в группе: там видно и
 * человека, и чат сразу, тогда как при регистрации на сайте таких
 * сведений нет вовсе.
 *
 * Сбой записи не должен ломать обработку сообщения: связь — удобство, а
 * не условие работы бота.
 */
export async function rememberUserChat(input: { telegramId: string; chatId: string }): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: input.telegramId },
      select: { id: true },
    })
    if (!user) return

    /* Чат должен быть заведён: связь на несуществующий чат нарушит
       ограничение внешнего ключа. Вебхук заводит его раньше, но порядок
       вызовов лучше не считать гарантией. */
    const chat = await prisma.telegramChat.findUnique({
      where: { id: input.chatId },
      select: { id: true },
    })
    if (!chat) return

    await prisma.telegramUserChat.upsert({
      where: { userId_chatId: { userId: user.id, chatId: chat.id } },
      update: { lastSeenAt: new Date() },
      create: { userId: user.id, chatId: chat.id },
    })
  } catch (error) {
    console.error("Запись чата участника:", error)
  }
}

/**
 * Куда публиковать объявление этого продавца.
 *
 * Если он пишет в нескольких чатах — берётся тот, где его видели
 * последним: это ближе всего к «откуда он пришёл» из тех сведений, что
 * у нас есть.
 */
async function pickChatForSeller(userId: string): Promise<string | null> {
  const membership = await prisma.telegramUserChat.findFirst({
    where: {
      userId,
      /* Только живые чаты с включённой рассылкой: в чат, где бота
         выключили, объявление слать нельзя. */
      chat: { active: true, marketingEnabled: true },
    },
    orderBy: { lastSeenAt: "desc" },
    select: { chatId: true },
  })
  return membership?.chatId ?? null
}

/**
 * Публикует свежее объявление в чат продавца.
 *
 * Возвращает признак отправки, но вызывающему он нужен только для
 * журнала: публикация в чат — приятное дополнение, и её неудача не
 * должна отменять само объявление.
 */
export async function autopostListingToChat(listingId: string): Promise<boolean> {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        price: true,
        status: true,
        deletedAt: true,
        userId: true,
        user: { select: { telegramId: true } },
        vehicle: {
          select: {
            id: true, year: true, mileage: true, power: true,
            fuelType: true, transmission: true, images: true, location: true,
          },
        },
      },
    })

    /* Публикуем только то, что видно на площадке: черновик или снятое
       объявление в чате — это ссылка в никуда. */
    if (!listing || listing.deletedAt || listing.status !== "ACTIVE") return false
    if (!listing.vehicle) return false

    const chatId = await pickChatForSeller(listing.userId)
    if (!chatId) return false

    /* Уже публиковали — второй раз не шлём: объявление могли снять и
       вернуть, а два одинаковых поста в чате раздражают больше, чем их
       отсутствие. */
    const already = await prisma.listingChatPost.findFirst({
      where: { chatId, listingId: listing.id },
      select: { id: true },
    })
    if (already) return false

    const post = buildChatPost(
      {
        id: listing.id,
        title: listing.title,
        price: listing.price,
        sellerTelegramId: listing.user.telegramId,
        year: listing.vehicle.year,
        mileage: listing.vehicle.mileage,
        power: listing.vehicle.power,
        fuelType: listing.vehicle.fuelType,
        transmission: listing.vehicle.transmission,
        images: parseImages(listing.vehicle.images),
        city: listing.vehicle.location,
      } satisfies PromotedListing,
      /* Имя бота может быть не настроено: тогда кнопки «в приложении» и
         «написать продавцу» просто не появятся, а пост уйдёт с одной
         ссылкой на сайт. */
      { botUsername: getTelegramBotUsername() ?? undefined, siteUrl: absoluteUrl("/") },
    )

    const sent = await sendPost(chatId, post)
    if (!sent) return false

    /* Запись публикации: по ней видно, что объявление уже уходило, и она
       же нужна уборке, если объявление снимут. */
    await prisma.listingChatPost.create({
      data: { chatId, listingId: listing.id, messageId: sent },
    })

    return true
  } catch (error) {
    console.error("Публикация объявления в чат:", error)
    return false
  }
}

/** Разбирает поле с картинками: там хранится строка JSON. */
function parseImages(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

/**
 * Отправляет пост и возвращает идентификатор сообщения.
 *
 * Несколько фотографий уходят альбомом, а кнопки — отдельным сообщением
 * следом: Telegram не поддерживает кнопки на альбоме, и другого способа
 * показать их вместе с девятью снимками нет.
 */
async function sendPost(
  chatId: string,
  post: { photos: string[]; caption: string; buttons: { text: string; url: string }[] },
): Promise<number | null> {
  const keyboard = { inline_keyboard: post.buttons.map((button) => [button]) }

  if (post.photos.length === 0) {
    const sent = await telegramApi<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text: post.caption,
      parse_mode: "HTML",
      reply_markup: keyboard,
    }).catch(() => null)
    return sent?.message_id ?? null
  }

  if (post.photos.length === 1) {
    const sent = await telegramApi<{ message_id: number }>("sendPhoto", {
      chat_id: chatId,
      photo: absoluteUrl(post.photos[0]),
      caption: post.caption,
      parse_mode: "HTML",
      reply_markup: keyboard,
    }).catch(() => null)
    return sent?.message_id ?? null
  }

  const album = await telegramApi<{ message_id: number }[]>("sendMediaGroup", {
    chat_id: chatId,
    media: post.photos.map((photo, index) => ({
      type: "photo",
      media: absoluteUrl(photo),
      /* Подпись только у первой: Telegram показывает её под альбомом, а
         повторённая на каждой фотографии дублируется в уведомлениях. */
      ...(index === 0 ? { caption: post.caption, parse_mode: "HTML" } : {}),
    })),
  }).catch(() => null)

  if (!album?.length) return null

  /* Кнопки следом, ответом на альбом: так они привязаны к нему визуально
     и не выглядят отдельным сообщением ни к чему. */
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: "Открыть объявление:",
    reply_to_message_id: album[0].message_id,
    reply_markup: keyboard,
  }).catch(() => {})

  return album[0].message_id
}
