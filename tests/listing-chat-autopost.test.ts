import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

/* Модуль читается как текст: он тянет Prisma через псевдоним «@/»,
   которого запускатель тестов не разбирает. */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

const autopost = read("../src/lib/listing-chat-autopost.ts")
/* Отправка вынесена в общий модуль: тот же порядок нужен обсуждениям
   форума, и держать его в двух местах значит однажды поправить одно и
   забыть про другое. */
const sender = read("../src/lib/telegram-post-sender.ts")
const post = read("../src/lib/chat-promotion-post.ts")
const webhook = read("../src/app/api/telegram/webhook/route.ts")
const moderation = read("../src/app/api/admin/listings/route.ts")
const miniApp = read("../src/components/telegram/TelegramMiniApp.tsx")

// === Куда уходит объявление ===

test("объявление уходит в чат, откуда пришёл продавец", () => {
  /* Его увидят те, среди кого он уже состоит: для чата под Владивосток
     это разница между «продаю Prado» среди своих и тем же объявлением
     среди всей страны. */
  assert.match(autopost, /prisma\.telegramUserChat\.findFirst/)
  assert.match(autopost, /orderBy: \{ lastSeenAt: "desc" \}/)
})

test("чат с выключенной рассылкой пропускается", () => {
  // В чат, где бота выключили, объявление слать нельзя.
  assert.match(autopost, /chat: \{ active: true, marketingEnabled: true \}/)
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

test("снятое объявление в чат не уходит", () => {
  // Пост на снятое объявление — ссылка в никуда.
  assert.match(autopost, /listing\.status !== "ACTIVE"\) return false/)
  assert.match(autopost, /listing\.deletedAt/)
})

test("одно объявление не уходит в тот же чат дважды", () => {
  /* Объявление могли снять и вернуть, а два одинаковых поста подряд
     раздражают больше, чем их отсутствие. */
  assert.match(autopost, /prisma\.listingChatPost\.findFirst/)
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

test("несколько фотографий уходят альбомом", () => {
  assert.match(sender, /sendMediaGroup/)
})

test("подпись только у первой фотографии альбома", () => {
  /* Telegram показывает её под альбомом, а повторённая на каждой
     дублируется в уведомлениях. */
  assert.match(sender, /index === 0 \? \{ caption/)
})

test("кнопки идут ответом на альбом", () => {
  // Telegram не поддерживает кнопки на альбоме.
  assert.match(sender, /reply_to_message_id: album\[0\]\.message_id/)
})

// === Кнопки ===

test("есть кнопка открытия в приложении", () => {
  /* Из чата человек уже в Telegram, и приложение открывается прямо
     здесь, а ссылка на сайт выбрасывает его в браузер. */
  assert.match(post, /startapp=listing_\$\{listing\.id\}/)
  assert.match(post, /Открыть в приложении/)
})

test("есть кнопка открытия на сайте", () => {
  assert.match(post, /Открыть на сайте/)
})

test("кнопка приложения не появляется без имени бота", () => {
  // Ссылка вида «https://t.me/undefined» просто не откроется.
  assert.match(post, /if \(options\.botUsername\) \{[\s\S]{0,200}startapp=listing_/)
})

test("связь с продавцом идёт через бот, а не напрямую", () => {
  /* Прямая ссылка раскрыла бы его аккаунт всем читателям чата, включая
     тех, кто машиной не интересуется. */
  assert.match(post, /Написать продавцу/)
  assert.match(post, /\?start=listing_\$\{listing\.id\}/)
})

// === Приложение открывает объявление ===

test("приложение понимает listing_<id>", () => {
  assert.match(miniApp, /LISTING_PARAM/)
  assert.match(miniApp, /\/listings\/vehicle\/\$\{listing\[1\]\}/)
})

test("чужая строка в параметре никуда не уводит", () => {
  /* Без проверки набора символов параметр стал бы открытым
     перенаправлением внутри приложения. */
  const pattern = miniApp.match(/const LISTING_PARAM = (\/[^\n]+\/i)/)
  assert.ok(pattern, "проверки параметра нет")

  const rule = new RegExp(pattern[1].slice(1, -2), "i")
  assert.ok(rule.test("listing_0d8e7de5-719d-422d-99a5-a6eb1a6ae13b"), "настоящий идентификатор отклонён")
  for (const bad of ["listing_../../admin", "listing_<script>", "listing_https://evil.example"]) {
    assert.ok(!rule.test(bad), `пропущено: ${bad}`)
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
