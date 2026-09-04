import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { resolveStartRoute } from "../src/lib/telegram-start-route.ts"

/* Модуль читается как текст: он тянет Prisma через псевдоним «@/»,
   которого запускатель тестов не разбирает. */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

const autopost = read("../src/lib/listing-chat-autopost.ts")
/* Отправка вынесена в общий модуль: тот же порядок нужен обсуждениям
   форума, и держать его в двух местах значит однажды поправить одно и
   забыть про другое. */
const sender = read("../src/lib/telegram-post-sender.ts")
/* Чтение снимков вынесено в общий модуль: им пользуются и бесплатная
   публикация, и платное продвижение. */
const photoFiles = read("../src/lib/telegram-photo-files.ts")
const collage = read("../src/lib/photo-collage.ts")
const paidDelivery = read("../src/lib/chat-promotion-delivery.ts")
const post = read("../src/lib/chat-promotion-post.ts")
const webhook = read("../src/app/api/telegram/webhook/route.ts")
const moderation = read("../src/app/api/admin/listings/route.ts")
const miniApp = read("../src/components/telegram/TelegramMiniApp.tsx")

// === Куда уходит объявление ===

test("чат выбирается по городу машины, а не по привычкам продавца", () => {
  /* Человек, который пишет в чат Уфы, а машину продаёт в Казани,
     показывал её не тем людям: за машиной в другой регион не поедут. */
  assert.match(autopost, /pickChatTitleForCity/)
  assert.match(autopost, /city: listing\.vehicle\.location/)
})

test("город без своего чата всё равно виден всей стране", () => {
  /* Чата под Марий Эл нет, но машина продаётся: показать всей стране
     лучше, чем не показать никому.

     Запасные ходы — общий чат страны и чат, где знают продавца — стали не
     нужны: рассылка идёт во все живые чаты сразу, и оба они туда входят.
     Проверяем само это свойство: выборка не сужается по названию. */
  assert.match(autopost, /prisma\.telegramChat\.findMany/)
  assert.doesNotMatch(autopost, /findChatByTitle/)
})

test("чат с выключенной рассылкой пропускается", () => {
  // В чат, где бота выключили, объявление слать нельзя.
  assert.match(autopost, /where: \{ active: true, marketingEnabled: true \}/)
})

test("связь человека и чата пишется из вебхука", () => {
  /* Там видно и человека, и чат сразу, тогда как при регистрации на
     сайте таких сведений нет вовсе. */
  assert.match(webhook, /void rememberUserChat\(\{ telegramId, chatId \}\)/)
})

test("запись связи не ломает обработку сообщения", () => {
  // Связь — удобство, а не условие работы бота.
  assert.match(autopost, /catch \(error\)[\s\S]{0,120}Запись чата участника/)
})

// === Когда уходит ===

test("публикуется одобренное, а не созданное", () => {
  /* В чат должно попадать проверенное, иначе бот разносит по группам то,
     что модератор ещё не видел. */
  assert.match(moderation, /status === LISTING_STATUS\.ACTIVE[\s\S]{0,200}autopostListingToChat/)
  const create = read("../src/app/api/listings/route.ts")
  assert.doesNotMatch(create, /autopostListingToChat/)
})

test("решение модератора не ждёт отправки в Telegram", () => {
  assert.match(moderation, /void autopostListingToChat\(id\)/)
})

test("после публикации продавцу пишет бот", () => {
  /* О публикации говорил только колокольчик на сайте, а из ста двадцати
     человек сто девятнадцать пришли из Telegram и на сайт заходят редко:
     одобренное объявление они не видели и не начинали продвигать. */
  assert.match(moderation, /notifyListingPublished\(id, chatTitle\)/)
})

test("уведомление называет чат, куда ушло объявление", () => {
  /* Без этого бесплатная рассылка остаётся для продавца невидимой, и он
     не понимает, за что платить продвижение.

     Чатов теперь несколько: называем первый и число остальных —
     перечислять дюжину имён в уведомлении незачем. */
  assert.match(autopost, /delivered\.length === 1/)
  assert.match(autopost, /и ещё \$\{delivered\.length - 1\}/)
})

test("объявление уходит во все чаты, а городской идёт первым", () => {
  /* Раньше выбирался один чат по городу: объявление из Уфы видел только
     уфимский чат, остальные одиннадцать не знали о нём вовсе.

     Городской остаётся первым в очереди — там объявление ближе всего к
     покупателю, и если рассылка упрётся в лимит Telegram, потеряются
     дальние чаты, а не свой. */
  assert.match(autopost, /function collectChatsForListing/)
  assert.match(autopost, /Number\(isCityChat\(right\)\) - Number\(isCityChat\(left\)\)/)

  /* Пауза между отправками: Telegram возвращает ошибку лимита на очередь
     сообщений подряд, и часть постов терялась бы. */
  assert.match(autopost, /const CHAT_POST_PAUSE_MS/)

  /* Отказ одного чата не отменяет остальные: бота могли выкинуть из одной
     группы, и это не повод лишать объявление всех прочих. */
  assert.match(autopost, /sendChatPost\([\s\S]{0,120}\.catch\(/)
})

test("снятое объявление в чат не уходит", () => {
  // Пост на снятое объявление — ссылка в никуда.
  assert.match(autopost, /listing\.status !== "ACTIVE"\) return null/)
  assert.match(autopost, /listing\.deletedAt/)
})

test("одно объявление не уходит в тот же чат дважды", () => {
  /* Объявление могли снять и вернуть, а два одинаковых поста подряд
     раздражают больше, чем их отсутствие. */
  /* Проверяем разом по всем чатам, а не по одному: иначе на дюжину чатов
     вышла бы дюжина запросов к базе. */
  assert.match(autopost, /prisma\.listingChatPost\.findMany/)
  assert.match(autopost, /postedChatIds/)
  const migration = read("../prisma/migrations/20260828110000_telegram_user_chat/migration.sql")
  assert.match(migration, /CREATE UNIQUE INDEX "ListingChatPost_listingId_chatId_key"/)
})

test("сбой публикации не отменяет объявление", () => {
  assert.match(autopost, /catch \(error\)[\s\S]{0,140}Публикация объявления в чат/)
})

// === Что в посте ===

test("до девяти фотографий", () => {
  assert.match(post, /MAX_POST_PHOTOS = 9/)
  assert.match(post, /slice\(0, MAX_POST_PHOTOS\)/)
})

test("пост уходит одним сообщением", () => {
  /* Telegram не даёт кнопки на альбоме: пост уходил снимками, а под ними
     оторванной строкой с кнопками — в чате это два разных поста. */
  assert.doesNotMatch(sender, /sendMediaGroup/)
  assert.doesNotMatch(sender, /reply_to_message_id/)
})

test("снимки склеиваются в одну картинку", () => {
  /* Одна фотография кнопки принимает — так в сообщении есть и все
     снимки, и текст, и кнопки. */
  assert.match(sender, /buildPhotoCollage/)
  assert.match(collage, /MAX_COLLAGE_PHOTOS = 9/)
})

test("склейка не рвётся на непрочитанном снимке", () => {
  // Пропущенный в середине оставил бы дыру в сетке.
  assert.match(sender, /files\.length === wanted\.length/)
})

test("если склейка не удалась, уходит первый снимок", () => {
  // Пост без части фотографий лучше, чем его отсутствие.
  assert.match(sender, /const single = wanted\[0\]/)
})

test("главный снимок остаётся крупным", () => {
  /* Он идёт первым и занимает верх: человек видит машину целиком, а не
     девять марок размером с ноготь. */
  assert.match(collage, /heroHeight/)
  assert.match(collage, /position: "attention"/)
})

test("свои снимки уходят файлом, а не ссылкой", () => {
  /* Ссылку на наши картинки Telegram не берёт: на «/uploads/...» он
     отвечает «failed to get HTTP URL content», хотя файл открывается и
     браузером, и curl. Проверено на продакшене. */
  assert.match(sender, /readLocalPhotos/)
  assert.match(sender, /telegramPhotoApi/)
})

test("читаются только файлы из /uploads", () => {
  /* Адрес приходит из базы: «/uploads/../../etc/passwd» не должен
     превращаться в чтение чужого файла. */
  assert.match(photoFiles, /startsWith\("\/uploads\/"\)/)
  assert.match(photoFiles, /name\.includes\("\.\."\)/)
})

test("платное продвижение шлёт снимки тем же способом", () => {
  /* Там адрес и вовсе передавался относительным — «/uploads/...», —
     а такой Telegram отвергает сразу: оплаченное продвижение уходило бы
     в чаты вовсе без фотографий. */
  assert.match(paidDelivery, /readLocalPhotos/)
  assert.match(paidDelivery, /telegramPhotoApi/)
  assert.doesNotMatch(paidDelivery, /photo: post\.photos\[0\] \}/)
})

test("внешний адрес остаётся ссылкой", () => {
  // Чужую картинку читать неоткуда, и Telegram забирает её сам.
  assert.match(sender, /absoluteUrl/)
})

// === Кнопки ===

test("кнопка ведёт на страницу объявления", () => {
  assert.match(post, /Открыть объявление/)
  assert.match(post, /listingUrl/)
})

test("адрес строится по идентификатору машины, а не объявления", () => {
  /* Страница открывается по /listings/vehicle/<id машины>. По id
     объявления сайт отвечает «такой страницы нет» — все кнопки в постах
     вели в никуда. */
  assert.match(autopost, /id: listing\.vehicle\.id/)
})

test("кнопки не ведут через startapp", () => {
  /* Telegram отвечает «bot invalid»: ссылка работает только у ботов с
     настроенным главным мини-приложением, а у нашего его нет.
     Проверяем сами адреса, а не упоминания в пояснениях. */
  assert.doesNotMatch(post, /url: `https:\/\/t\.me\/\$\{options\.botUsername\}\?startapp/)
})

test("связь с продавцом не раскрывает его аккаунт", () => {
  assert.match(post, /Написать продавцу/)
  assert.doesNotMatch(post, /url: `https:\/\/t\.me\/[^`]*start=listing_/)
})

// === Приложение открывает объявление ===

test("приложение понимает listing_<id>", () => {
  /* Разбор переехал из компонента в telegram-start-route: раньше проверка
     читала исходник и сверяла регулярку глазами, теперь вызывает саму
     функцию — то, что действительно работает у человека. */
  const route = resolveStartRoute("start_param=listing_0d8e7de5-719d-422d-99a5-a6eb1a6ae13b")

  assert.ok(route)
  assert.ok(route.includes("/listings/vehicle/0d8e7de5-719d-422d-99a5-a6eb1a6ae13b"))
})

test("чужая строка в параметре никуда не уводит", () => {
  /* Без проверки набора символов параметр стал бы открытым
     перенаправлением внутри приложения. */
  for (const bad of ["listing_../../admin", "listing_<script>", "listing_https://evil.example"]) {
    assert.equal(resolveStartRoute(`start_param=${bad}`), null, `пропущено: ${bad}`)
  }
})

// === Уборка постов снятых объявлений ===

test("пост убирается, когда объявление сняли", () => {
  /* Пост на снятое объявление ведёт на пустую страницу: человек нажимает
     кнопку из чата и попадает в никуда. */
  assert.match(autopost, /export async function cleanupSoldListingPosts/)
  assert.match(autopost, /listing: \{ deletedAt: \{ not: null \} \}/)
  assert.match(autopost, /listing: \{ status: \{ not: "ACTIVE" \} \}/)
})

test("уборка идёт по расписанию, а не при снятии", () => {
  /* Ловить момент снятия в каждом из мест, где объявление меняют, значит
     забыть об одном из них. */
  const schedule = read("../src/app/api/telegram/chat-promotion/route.ts")
  assert.match(schedule, /cleanupSoldListingPosts\(\)/)
})

test("удалённое вручную сообщение не держит запись", () => {
  // Telegram ответит ошибкой, и это не повод оставлять запись висеть.
  const cleanup = autopost.slice(autopost.indexOf("cleanupSoldListingPosts"))
  assert.match(cleanup, /deleteMessage[\s\S]{0,160}catch\(\(\) => \{\}\)/)
  assert.match(cleanup, /removedAt: new Date\(\)/)
})

test("убранное второй раз не трогается", () => {
  assert.match(autopost, /removedAt: null/)
})

// === Язык поста ===

test("коробка и топливо пишутся по-русски", () => {
  /* Пост уходил в чаты строкой «MANUAL · GASOLINE» — латиницей,
     машинными словами. Подписчик читает объявление на своём языке. */
  assert.match(post, /MANUAL: "механика"/)
  assert.match(post, /GASOLINE: "бензин"/)
})

test("«OTHER» в посте не показывается", () => {
  /* Это отсутствие сведений, а не характеристика: строка «⚙️ 2010 г. ·
     Другая · Другое» не говорит ничего, а место занимает. */
  assert.doesNotMatch(post, /OTHER: "/)
})

test("неизвестный латинский код молчит, а готовое русское слово проходит", () => {
  /* Часть источников отдаёт «Автомат» вместо «AUTOMATIC» — отбрасывать
     его было бы потерей настоящих сведений. */
  assert.match(post, /\[а-яё\]\/i\.test\(value\)/)
  assert.match(post, /return null/)
})

test("неполный ряд плиток растягивается на всю ширину", () => {
  /* Одна плитка шириной в треть, прижатая влево, с пустотой справа
     читается как сбой вёрстки, а не как раскладка. */
  assert.match(collage, /inThisRow/)
  assert.match(collage, /WIDTH - GAP \* \(inThisRow - 1\)/)
})

test("в ряду не больше трёх снимков", () => {
  // На плитке шириной в четверть машина перестаёт читаться.
  assert.match(collage, /for \(const size of \[3, 2\]\)/)
})
