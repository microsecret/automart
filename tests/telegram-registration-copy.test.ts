import assert from "node:assert/strict"
import test from "node:test"
import {
  buildReminderText,
  completedStepCount,
  describePendingSteps,
  pendingSteps,
  progressBar,
  resumeButtonLabel,
  REGISTRATION_STEPS,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/telegram-registration-copy.ts"

test("прогресс считается от пройденных шагов", () => {
  assert.equal(completedStepCount("contact"), 0)
  assert.equal(completedStepCount("email"), 1)
  assert.equal(completedStepCount("password"), 2)
  assert.equal(completedStepCount("complete"), 3)
})

test("полоса прогресса всегда из трёх кружков", () => {
  for (const step of [...REGISTRATION_STEPS, "complete"] as const) {
    const bar = progressBar(step)
    assert.equal([...bar.matchAll(/🟢|⚪️/g)].length, 3, `шаг ${step}: ${bar}`)
  }
  assert.equal(progressBar("password"), "🟢🟢⚪️")
})

test("завершившему регистрацию ничего не предлагается", () => {
  assert.deepEqual(pendingSteps("complete"), [])
  assert.deepEqual(describePendingSteps("complete").slice(2), [])
})

test("пройденные шаги не показываются заново", () => {
  // Ради этого всё и делалось: человек, подтвердивший телефон, не должен
  // снова читать «подтвердите телефон».
  const text = describePendingSteps("email").join("\n")
  assert.ok(!text.includes("Телефон"), text)
  assert.ok(text.includes("Почта") && text.includes("Пароль"))
})

test("склонения не ломаются ни на одном шаге", () => {
  const email = describePendingSteps("email").join(" ")
  const password = describePendingSteps("password").join(" ")
  assert.match(email, /осталось 2 шага/)
  assert.match(password, /остался последний шаг/)
  // Частая ошибка при склейке — «осталсяось» и подобное.
  for (const text of [email, password]) {
    assert.ok(!/осталсяось|остальось|осталосься/.test(text), text)
  }
})

test("напоминание называет нужный шаг и объясняет удаление сообщений", () => {
  const text = buildReminderText("email", "Гитарист")
  assert.ok(text.includes("Гитарист,"), "должно быть обращение по имени")
  assert.ok(text.includes("почта") || text.includes("Почта"))
  assert.ok(text.includes("удаляются автоматически"), "человек должен понять причину удаления")
  assert.ok(text.includes("пройдено 1 из 3"))
})

test("без имени текст остаётся связным", () => {
  const text = buildReminderText("password", null)
  assert.ok(!text.includes("null") && !text.includes(" ,"), text)
  assert.ok(text.includes("вы начали регистрацию"))
})

test("кнопка зовёт к конкретному действию", () => {
  assert.match(resumeButtonLabel("email"), /почту/i)
  assert.match(resumeButtonLabel("password"), /пароль/i)
  // Первый шаг зовёт пройти регистрацию целиком: человек ещё не знает, что
  // она начинается с телефона, и слово «телефон» его не объясняет.
  assert.match(resumeButtonLabel("contact"), /регистрацию/i)
  assert.match(resumeButtonLabel("complete"), /Завершить/)
})
