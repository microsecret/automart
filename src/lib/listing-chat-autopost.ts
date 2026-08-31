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
import { pickChatTitleForCity } from "@/lib/city-chat-routing"

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
/* Пауза между отправками в разные чаты.

   Telegram не любит очередь сообщений подряд от одного бота: без паузы
   часть постов возвращается ошибкой лимита, и объявление доходит не всюду.
   Секунда с небольшим держит темп ниже порога и не растягивает рассылку
   по дюжине чатов дольше полуминуты. */
const CHAT_POST_PAUSE_MS = 1_200

/**
 * Все чаты, куда уходит объявление.
 *
 * Раньше выбирался один — по городу; объявление из Уфы видел только
 * уфимский чат, а остальные одиннадцать не знали о нём вовсе. Теперь пост
 * уходит во все живые чаты с включённой рассылкой.
 *
 * Городской идёт первым: там объявление ближе всего к покупателю, и если
 * дальше упрётся в лимит Telegram, потеряются дальние чаты, а не свой.
 */
async function collectChatsForListing(input: { userId: string; city: string | null }): Promise<PickedChat[]> {
  const chats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true, title: true },
  })
  if (!chats.length) return []

  const cityTitle = pickChatTitleForCity(input.city)
  const isCityChat = (chat: PickedChat) => Boolean(cityTitle && chat.title?.includes(cityTitle))

  return [...chats].sort((left, right) => Number(isCityChat(right)) - Number(isCityChat(left)))
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

    const chats = await collectChatsForListing({
      userId: listing.userId,
      city: listing.vehicle.location,
    })
    if (!chats.length) return null

    /* Куда уже публиковали — туда второй раз не шлём: объявление могли
       снять и вернуть, а два одинаковых поста в чате раздражают больше,
       чем их отсутствие. Проверяем разом по всем чатам, а не по одному:
       иначе на дюжину чатов вышла бы дюжина запросов к базе. */
    const posted = await prisma.listingChatPost.findMany({
      where: { listingId: listing.id },
      select: { chatId: true },
    })
    const postedChatIds = new Set(posted.map((row) => String(row.chatId)))
    const pending = chats.filter((chat) => !postedChatIds.has(String(chat.id)))
    if (!pending.length) return null

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

    /* Рассылка идёт по одному чату с паузой, а не всем разом: параллельная
       отправка упирается в лимит Telegram, и часть постов теряется. */
    const delivered: string[] = []
    for (let index = 0; index < pending.length; index += 1) {
      const chat = pending[index]
      /* Отказ одного чата не отменяет остальные: бота могли выкинуть из
         одной группы, и это не повод лишать объявление всех прочих. */
      const sent = await sendChatPost(chat.id, post, { buttonsCaption: "Открыть объявление:" }).catch((error) => {
        console.error(`Публикация объявления в чат ${chat.title}:`, error instanceof Error ? error.message : error)
        return null
      })
      if (sent) {
        /* Запись публикации: по ней видно, что объявление уже уходило, и
           она же нужна уборке, если объявление снимут. */
        await prisma.listingChatPost.create({
          data: { chatId: chat.id, listingId: listing.id, messageId: sent },
        })
        /* Имя чата задаёт владелец в Telegram и может быть пустым: в
           уведомлении продавцу тогда честнее сказать «чат», чем «null». */
        delivered.push(chat.title || "чат")
      }
      if (index < pending.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, CHAT_POST_PAUSE_MS))
      }
    }

    if (!delivered.length) return null

    /* Название возвращается наверх: продавцу в уведомлении надо сказать,
       куда ушло объявление, — иначе бесплатная рассылка остаётся для него
       невидимой. Чатов теперь несколько, поэтому называем первый и число
       остальных: перечислять дюжину имён в уведомлении незачем. */
    return delivered.length === 1
      ? delivered[0]
      : `${delivered[0]} и ещё ${delivered.length - 1}`
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
