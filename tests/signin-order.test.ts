import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const form = readFileSync(new URL("../src/components/auth/SignInForm.tsx", import.meta.url), "utf8")

test("вход через Telegram идёт выше пароля", () => {
  /* Девяносто девять человек из ста двадцати пришли через Telegram, а
     страница встречала их полем пароля, которого у них нет: ссылка на
     бота была мелким текстом под формой. */
  const telegramAt = form.indexOf("Войти через Telegram")
  const passwordAt = form.indexOf("<PasswordInput")
  assert.ok(telegramAt > 0, "кнопки Telegram нет")
  assert.ok(passwordAt > 0, "поля пароля нет")
  assert.ok(telegramAt < passwordAt, "пароль стоит выше Telegram")
})

test("предложение не повторяется дважды", () => {
  // То же самое двумя блоками читается как сбой вёрстки.
  const matches = form.match(/auth\/signup\?callbackUrl/g) || []
  assert.equal(matches.length, 1, `ссылок на регистрацию: ${matches.length}`)
})

test("вход по паролю остаётся доступен", () => {
  /* Те, кто регистрировался раньше, входят по паролю — убирать его
     нельзя. */
  assert.match(form, /<PasswordInput/)
  assert.match(form, /или по паролю/)
})
