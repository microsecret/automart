import assert from "node:assert/strict"
import test from "node:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { hasBearerToken } from "../src/lib/bearer-token.ts"

const req = (value?: string) => new Request("https://lewheel.ru/api/x", { headers: value ? { authorization: value } : {} })

test("служебный ключ проверяется целиком и только при настроенном сервере", () => {
  assert.equal(hasBearerToken(req("Bearer secret"), "secret"), true)
  assert.equal(hasBearerToken(req("Bearer secreT"), "secret"), false)
  assert.equal(hasBearerToken(req("Bearer secret2"), "secret"), false)
  assert.equal(hasBearerToken(req(), "secret"), false)
  /* Ненастроенный ключ не открывает маршрут даже пустым заголовком. */
  assert.equal(hasBearerToken(req("Bearer "), ""), false)
  assert.equal(hasBearerToken(req("Bearer undefined"), undefined), false)
})

test("в маршрутах API нет сравнения ключа через !==", () => {
  /* Аудит 28.10.2026: 14 маршрутов парсера и сверки платежей сравнивали
     ключ обычным неравенством — по времени ответа его можно подбирать. */
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (name === "route.ts") files.push(full)
    }
  }
  walk(new URL("../src/app/api", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))
  const offenders = files.filter((file) => /!== `Bearer \$\{/.test(readFileSync(file, "utf8")))
  assert.deepEqual(offenders, [])
})
