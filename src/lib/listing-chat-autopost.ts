/**
 * Объявление уходит в чат сразу после публикации.
 *
 * Раньше объявление попадало в чаты только через платное продвижение, то
 * есть почти никогда: человек размещал машину и ждал звонков от тех, кто
 * сам зайдёт на сайт.
 *
 * Бесплатно объявление уходит в один чат — тот, что отвечает городу
 * машины. Для чата под Уфу это разница между «продаю Приору в
 * Октябрьском» среди тех, кто может за ней приехать, и тем же
 * объявлением среди всей страны.
 *
 * Раньше чат выбирался по тому, где видели самого продавца. Человек,
 * который пишет в чат Уфы, а машину продаёт в Казани, показывал её не
 * тем людям: за машиной в другой регион не поедут.
 *
 * Платное продвижение остаётся тем, чем было: все чаты сети, закреп и
 * повторные размещения — за это и платят.
 */

import { prisma } from "@/lib/prisma"
import { telegramApi, getTelegramBotUsername } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import { buildChatPost, type PromotedListing } from "@/lib/chat-promotion-post"
/* Отправка вынесена в общий модуль: тот же порядок нужен и обсуждениям
   форума, а держать его в двух местах значит однажды поправить одно и
   забыть про другое. */
import { sendChatPost } from "@/lib/telegram-post-sender"
import { pickChatTitleForCity, FALLBACK_CHAT_TITLE } from "@/lib/city-chat-routing"

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

/** Чат вместе с названием: название уходит продавцу в уведомлении.

    Название может быть пустым: бота могли добавить в группу до того, как
    ей дали имя. Тогда продавцу про чат просто не скажут. */
type PickedChat = { id: string; title: string | null }

/**
 * Куда публиковать объявление — по городу машины.
 *
 * Сначала выбирался чат, где продавца видели последним. Для человека,
 * который пишет в чат Уфы, а машину продаёт в Казани, это значило
 * объявление не для тех людей: за машиной в другой регион не поедут.
 *
 * Город машины — признак вернее: он есть в каждом объявлении и не
 * зависит от того, писал ли продавец в чаты вообще. Правила разбора — в
 * city-chat-routing, они проверяются тестами отдельно.
 *
 * Членство осталось запасным ходом: если чата под область нет ни
 * подходящего, ни общего, объявление уйдёт туда, где продавца знают, —
 * это лучше, чем не отправить вовсе.
 */
async function pickChatForListing(input: { userId: string; city: string | null }): Promise<PickedChat | null> {
  const byCity = await findChatByTitle(pickChatTitleForCity(input.city))
  if (byCity) return byCity

  /* Города не хватило — общий чат страны. Он мог быть выключен, тогда
     идём дальше. */
  const fallback = await findChatByTitle(FALLBACK_CHAT_TITLE)
  if (fallback) return fallback

  return pickChatForSeller(input.userId)
}

/**
 * Ищет живой чат по названию.
 *
 * Названия чатов задаёт владелец в Telegram, и переименование там ничем
 * не отзывается у нас — поэтому сравнение нестрогое, по вхождению
 * ключевого слова, а не по точному равенству.
 */
async function findChatByTitle(title: string): Promise<PickedChat | null> {
  const chat = await prisma.telegramChat.findFirst({
    where: {
      /* Только живые чаты с включённой рассылкой: в чат, где бота
         выключили, объявление слать нельзя. */
      active: true,
      marketingEnabled: true,
      title: { contains: title },
    },
    select: { id: true, title: true },
  })
  return chat ? { id: chat.id, title: chat.title } : null
}

/**
 * Запасной ход: чат, где продавца видели последним.
 *
 * Используется, когда по городу чат не нашёлся и общего чата тоже нет.
 */
async function pickChatForSeller(userId: string): Promise<PickedChat | null> {
  const membership = await prisma.telegramUserChat.findFirst({
    where: {
      userId,
      chat: { active: true, marketingEnabled: true },
    },
    orderBy: { lastSeenAt: "desc" },
    select: { chatId: true, chat: { select: { title: true } } },
  })
  return membership ? { id: membership.chatId, title: membership.chat.title } : null
}

/**
 * Публикует свежее объявление в чат продавца.
 *
 * Возвращает признак отправки, но вызывающему он нужен только для
 * журнала: публикация в чат — приятное дополнение, и её неудача не
 * должна отменять само объявление.
 */
export async function autopostListingToChat(listingId: string): Promise<string | null> {
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
    if (!listing || listing.deletedAt || listing.status !== "ACTIVE") return null
    if (!listing.vehicle) return null

    const chat = await pickChatForListing({
      userId: listing.userId,
      city: listing.vehicle.location,
    })
    if (!chat) return null

    /* Уже публиковали — второй раз не шлём: объявление могли снять и
       вернуть, а два одинаковых поста в чате раздражают больше, чем их
       отсутствие. */
    const already = await prisma.listingChatPost.findFirst({
      where: { chatId: chat.id, listingId: listing.id },
      select: { id: true },
    })
    if (already) return null

    const post = buildChatPost(
      {
        /* Идентификатор машины, а не объявления: страница открывается по
           адресу /listings/vehicle/<id машины>, и по id объявления сайт
           отвечает «такой страницы нет». Платное продвижение всегда
           передавало верный, а бесплатная публикация — нет, и все кнопки
           в постах вели в никуда. */
        id: listing.vehicle.id,
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

    const sent = await sendChatPost(chat.id, post, { buttonsCaption: "Открыть объявление:" })
    if (!sent) return null

    /* Запись публикации: по ней видно, что объявление уже уходило, и она
       же нужна уборке, если объявление снимут. */
    await prisma.listingChatPost.create({
      data: { chatId: chat.id, listingId: listing.id, messageId: sent },
    })

    /* Название возвращается наверх: продавцу в уведомлении надо сказать,
       в какой именно чат ушло объявление, — иначе бесплатная рассылка
       остаётся для него невидимой. */
    return chat.title
  } catch (error) {
    console.error("Публикация объявления в чат:", error)
    return null
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
 * Убирает из чатов посты снятых объявлений.
 *
 * Пост на снятое объявление ведёт на пустую страницу: человек нажимает
 * кнопку из чата и попадает в никуда, а чат при этом выглядит
 * заброшенным.
 *
 * Запускается по расписанию вместе с уборкой платных постов: ловить
 * момент снятия объявления в каждом из мест, где его меняют, значит
 * забыть об одном из них.
 */
export async function cleanupSoldListingPosts(): Promise<number> {
  try {
    const stale = await prisma.listingChatPost.findMany({
      where: {
        removedAt: null,
        /* Снятое, проданное, удалённое — всё, чего больше нет на
           площадке. Условие через listing, а не через отдельное поле:
           одно место правды вместо двух расходящихся. */
        OR: [
          { listing: { deletedAt: { not: null } } },
          { listing: { status: { not: "ACTIVE" } } },
        ],
      },
      select: { id: true, chatId: true, messageId: true },
      take: 200,
    })

    let removed = 0
    for (const post of stale) {
      /* Сообщение могли удалить руками в самом чате — тогда Telegram
         ответит ошибкой, и это не повод оставлять запись висеть. */
      await telegramApi("deleteMessage", {
        chat_id: post.chatId,
        message_id: post.messageId,
      }).catch(() => {})

      await prisma.listingChatPost.update({
        where: { id: post.id },
        data: { removedAt: new Date() },
      })
      removed += 1
    }

    return removed
  } catch (error) {
    console.error("Уборка постов снятых объявлений:", error)
    return 0
  }
}
