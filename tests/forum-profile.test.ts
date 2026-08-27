import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

/* Модули читаются как текст: они тянут Prisma через псевдоним «@/»,
   которого запускатель тестов не разбирает. */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

const usersRoute = read("../src/app/api/users/route.ts")
const memberPage = read("../src/app/forum/users/[name]/page.tsx")
const topicPage = read("../src/app/forum/[section]/[topic]/page.tsx")
const migration = read("../prisma/migrations/20260828030000_forum_profiles/migration.sql")

// === Подпись ===

test("ссылки в подписи запрещены", () => {
  /* Подпись видна под каждым сообщением человека, и ссылка в ней это
     реклама на всю площадку, которую модератору пришлось бы вычищать по
     одному сообщению. */
  const pattern = usersRoute.match(/if \(signature && (\/[^\n]+\/i)\.test\(signature\)\)/)
  assert.ok(pattern, "проверки ссылок в подписи нет")

  const rule = new RegExp(pattern[1].slice(1, -2), "i")
  for (const bad of [
    "Купить дёшево https://spam.example",
    "пишите www.spam.example",
    "мой канал t.me/spamchannel",
    "телега @spamdealer",
  ]) {
    assert.ok(rule.test(bad), `пропущено: ${bad}`)
  }

  for (const good of ["Haval Jolion 2023, Москва", "Езжу на Camry с 2019", "Механик, Владивосток"]) {
    assert.ok(!rule.test(good), `зря отклонено: ${good}`)
  }
})

test("подпись ограничена по длине", () => {
  // Длинная подпись у активного участника занимает больше места, чем его ответ.
  assert.match(usersRoute, /signature\.length > FORUM_SIGNATURE_MAX/)
})

test("отсутствие подписи в запросе не стирает сохранённую", () => {
  /* Имя меняют отдельно от подписи, и запрос без этого поля не должен
     обнулять написанное. */
  assert.match(usersRoute, /const signatureGiven = typeof payload\?\.forumSignature === "string"/)
  assert.match(usersRoute, /signatureGiven \? \{ name, forumSignature/)
})

// === Счётчик сообщений ===

test("счётчик сообщений растёт в той же сделке, что и остальные", () => {
  /* Разъедься он с действительностью — под именем человека одно число, а
     сообщений в базе другое. */
  const posts = read("../src/app/api/forum/posts/route.ts")
  const topics = read("../src/app/api/forum/topics/route.ts")
  for (const [name, source] of [["ответы", posts], ["новые темы", topics]] as const) {
    const transaction = source.slice(source.indexOf("$transaction"))
    assert.match(transaction, /forumPostCount: \{ increment: 1 \}/, `не считается в: ${name}`)
  }
})

test("существующие сообщения перенесены в счётчик", () => {
  // Иначе у всех авторов был бы ноль при непустом форуме.
  assert.match(migration, /UPDATE "User"[\s\S]*?SELECT COUNT\(\*\) FROM "ForumPost"/)
  // Удалённые не считаются: их в теме не видно.
  assert.match(migration, /"ForumPost"\."deletedAt" IS NULL/)
})

// === Страница участника ===

test("страница участника открывается по имени из упоминания", () => {
  /* Разметка строит ссылку по имени, и отдельный опознаватель значил бы
     поддерживать два адреса одного человека. */
  const markup = read("../src/lib/forum-markup.ts")
  assert.match(markup, /\/forum\/users\/\$\{encodeURIComponent\(name\)\}/)
  assert.match(memberPage, /where: \{ name \}/)
})

test("на странице участника видно, кто он", () => {
  for (const field of ["forumPostCount", "forumBestAnswers", "forumReputation", "forumSignature"]) {
    assert.match(memberPage, new RegExp(field), `нет поля: ${field}`)
  }
})

test("на странице участника показаны его сообщения без разметки", () => {
  // Пометки Markdown в списке выглядят мусором.
  assert.match(memberPage, /stripForumMarkup\(post\.content\)/)
  assert.match(memberPage, /deletedAt: null/)
})

test("имя в теме ведёт на профиль", () => {
  // Увидев дельный ответ, читатель хочет понять, кто это написал.
  assert.match(topicPage, /href=\{`\/forum\/users\/\$\{encodeURIComponent\(post\.author\.name\)\}`\}/)
})

test("подпись не показывается под удалённым сообщением", () => {
  assert.match(topicPage, /!post\.deletedAt && post\.author\.forumSignature/)
})

test("из профиля участника можно ему написать", () => {
  /* Это то, ради чего человека и ищут на форуме: дельный ответ рождает
     вопрос, который в теме задавать незачем. */
  assert.match(memberPage, /\/messages\/new\?recipientId=/)
})

test("кнопка не показывается гостю и самому себе", () => {
  /* Писать себе некуда, а гостю кнопка предложила бы вход ради действия,
     которого он ещё не хотел. */
  assert.match(memberPage, /session\?\.user\?\.id !== member\.id/)
  assert.match(memberPage, /canWrite && \(/)
})
