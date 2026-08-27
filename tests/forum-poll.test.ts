import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { POLL_LIMITS, isPollClosed, pluralVotes, pollShares, validatePollDraft } from "../src/lib/forum-poll.ts"

// === Проверка черновика ===

test("опрос без вопроса не создаётся", () => {
  const result = validatePollDraft({ question: "   ", options: ["А", "Б"] })
  assert.equal(result.ok, false)
})

test("одного варианта мало", () => {
  // Один вариант — это не опрос, а утверждение.
  const result = validatePollDraft({ question: "Какую взять?", options: ["Jolion"] })
  assert.equal(result.ok, false)
})

test("пустые варианты отсеиваются до подсчёта", () => {
  const result = validatePollDraft({ question: "Какую взять?", options: ["Jolion", "  ", ""] })
  assert.equal(result.ok, false, "остался один непустой вариант, этого мало")
})

test("повторяющиеся варианты не проходят", () => {
  /* Одинаковые варианты рассыпают голоса: половина отметит первый
     «Jolion», половина второй, и итог не значит ничего. */
  const result = validatePollDraft({ question: "Какую?", options: ["Jolion", " jolion "] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /повторяется/)
})

test("вариантов не больше предела", () => {
  const many = Array.from({ length: POLL_LIMITS.optionsMax + 1 }, (_, i) => `Вариант ${i}`)
  const result = validatePollDraft({ question: "Какую?", options: many })
  assert.equal(result.ok, false)
})

test("годный опрос возвращает готовые значения", () => {
  const result = validatePollDraft({ question: "  Какую взять?  ", options: [" Jolion ", "F7"] })
  assert.equal(result.ok, true)
  if (result.ok) {
    // Обрезка пробелов делается один раз здесь, а не повторяется в маршруте.
    assert.equal(result.question, "Какую взять?")
    assert.deepEqual(result.options, ["Jolion", "F7"])
    assert.equal(result.multiple, false)
    assert.equal(result.closesAt, null)
  }
})

test("срок голосования считается от сегодня", () => {
  const result = validatePollDraft({ question: "Какую?", options: ["А", "Б"], closesInDays: 7 })
  assert.equal(result.ok, true)
  if (result.ok && result.closesAt) {
    const days = (result.closesAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    assert.ok(days > 6.9 && days < 7.1, `ожидалось около семи дней, вышло ${days}`)
  }
})

test("срок дольше года отклоняется", () => {
  // Опрос без края превращается в мусор, о котором забыли.
  const result = validatePollDraft({
    question: "Какую?",
    options: ["А", "Б"],
    closesInDays: POLL_LIMITS.maxDurationDays + 1,
  })
  assert.equal(result.ok, false)
})

// === Завершение ===

test("опрос без срока не заканчивается", () => {
  // Обсуждение модели живёт годами, закрывать такой опрос незачем.
  assert.equal(isPollClosed({ closesAt: null }), false)
})

test("опрос с прошедшим сроком закрыт", () => {
  assert.equal(isPollClosed({ closesAt: new Date(Date.now() - 1000) }), true)
  assert.equal(isPollClosed({ closesAt: new Date(Date.now() + 60_000) }), false)
})

// === Доли ===

test("при нуле голосов полосы пустые, а не поделены поровну", () => {
  // «По 33% у всех» читается как результат, которого нет.
  const shares = pollShares([{ id: "a", votes: 0 }, { id: "b", votes: 0 }, { id: "c", votes: 0 }])
  assert.equal(shares.get("a"), 0)
  assert.equal(shares.get("c"), 0)
})

test("доли считаются от общего числа голосов", () => {
  const shares = pollShares([{ id: "a", votes: 3 }, { id: "b", votes: 1 }])
  assert.equal(shares.get("a"), 75)
  assert.equal(shares.get("b"), 25)
})

// === Склонение ===

test("склонение слова «голос»", () => {
  assert.equal(pluralVotes(1), "1 голос")
  assert.equal(pluralVotes(2), "2 голоса")
  assert.equal(pluralVotes(5), "5 голосов")
  assert.equal(pluralVotes(11), "11 голосов")
  assert.equal(pluralVotes(21), "21 голос")
  assert.equal(pluralVotes(112), "112 голосов")
  assert.equal(pluralVotes(0), "0 голосов")
})

// === Защита от двойного голоса ===

test("уникальность голоса стоит в базе, а не только в проверке кода", () => {
  /* Два нажатия подряд с телефона уходят двумя запросами одновременно, и
     проверка «уже голосовал» в коде пропустит оба: счётчик вырастет на
     два при одном участнике. Спасает только ограничение в базе. */
  const migration = readFileSync(
    new URL("../prisma/migrations/20260827200000_forum_polls/migration.sql", import.meta.url),
    "utf8",
  )
  assert.match(migration, /CREATE UNIQUE INDEX "ForumPollVote_optionId_userId_key"/)
})

test("нарушение уникальности не считается сбоем", () => {
  // Голос уже учтён — человеку так и надо сказать, а не показывать ошибку.
  const source = readFileSync(new URL("../src/lib/forum-poll-store.ts", import.meta.url), "utf8")
  assert.match(source, /P2002/)
  assert.match(source, /Вы уже голосовали/)
})

test("голос и счётчик меняются одной сделкой", () => {
  /* Иначе цифра под опросом разойдётся с числом записанных голосов при
     первом же сбое посередине. */
  const source = readFileSync(new URL("../src/lib/forum-poll-store.ts", import.meta.url), "utf8")
  assert.match(source, /\$transaction/)
})

test("опрос заводит только автор темы", () => {
  /* Возможность приложить голосование к чужому обсуждению — способ
     увести разговор в сторону чужими руками. */
  const route = readFileSync(new URL("../src/app/api/forum/polls/route.ts", import.meta.url), "utf8")
  assert.match(route, /topic\.authorId !== guard\.userId/)
})

// === Связка формы и маршрутов ===

test("опрос проверяется до публикации темы, а не после", () => {
  /* Иначе человек узнаёт об ошибке в опросе, когда тема уже создана и
     исправлять поздно. */
  const form = readFileSync(new URL("../src/app/forum/[section]/NewTopicForm.tsx", import.meta.url), "utf8")
  const checkAt = form.indexOf("validatePollDraft")
  const postAt = form.indexOf("/api/forum/topics")
  assert.ok(checkAt > 0, "проверки опроса в форме нет")
  assert.ok(checkAt < postAt, "проверка опроса идёт после отправки темы")
})

test("неудача опроса не отменяет публикации темы", () => {
  // Тема написана и опубликована, терять текст из-за опроса обидно.
  const form = readFileSync(new URL("../src/app/forum/[section]/NewTopicForm.tsx", import.meta.url), "utf8")
  assert.match(form, /Тема создана, опрос — нет/)
})

test("голосование требует входа", () => {
  const route = readFileSync(new URL("../src/app/api/forum/polls/vote/route.ts", import.meta.url), "utf8")
  assert.match(route, /requireUser/)
})

test("варианты выдаются в заданном порядке", () => {
  /* Без явного порядка база вольна вернуть их как угодно, и опрос при
     каждом обновлении страницы выглядит перетасованным. */
  const route = readFileSync(new URL("../src/app/api/forum/polls/route.ts", import.meta.url), "utf8")
  assert.match(route, /orderBy: \{ position: "asc" \}/)
  const vote = readFileSync(new URL("../src/app/api/forum/polls/vote/route.ts", import.meta.url), "utf8")
  assert.match(vote, /orderBy: \{ position: "asc" \}/)
})

test("до голосования проценты не показываются", () => {
  /* Видимые проценты тянут отметить то, что уже выбрало большинство, и
     опрос перестаёт что-либо измерять. */
  const block = readFileSync(new URL("../src/components/forum/PollBlock.tsx", import.meta.url), "utf8")
  assert.match(block, /const showResults = voted \|\| closed/)
})

test("рост полосы отключается при отказе от движения", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
  const reduced = css.slice(css.indexOf("forum-poll__bar"))
  assert.match(reduced, /prefers-reduced-motion[\s\S]*?forum-poll__bar\s*\{\s*animation: none/)
})
