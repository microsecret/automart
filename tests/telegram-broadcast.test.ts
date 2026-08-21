import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { audienceWhere } from "../src/lib/telegram-broadcast-audience.ts"

/**
 * От этого условия зависит, кому уйдёт рассылка. Ошибка здесь означает либо
 * сообщение не той аудитории, либо отправку тем, кто заблокировал бота — и
 * ответные жалобы на спам.
 */

test("заблокировавшие бота исключены из любой аудитории", () => {
  for (const audience of ["all", "registered", "unregistered"] as const) {
    const where = audienceWhere(audience)
    assert.equal(where.blocked, false, `аудитория «${audience}» не отсекает блокировки`)
  }
})

test("«не закончившим» уходит только незарегистрированным", () => {
  const where = audienceWhere("unregistered") as Record<string, unknown>
  assert.equal(where.registered, false)
  assert.equal(where.blocked, false)
})

test("«зарегистрированным» уходит только прошедшим регистрацию", () => {
  const where = audienceWhere("registered") as Record<string, unknown>
  assert.equal(where.registered, true)
})

test("«всем» не фильтрует по регистрации", () => {
  const where = audienceWhere("all")
  assert.equal("registered" in where, false, "аудитория «всем» не должна ограничивать по регистрации")
})
