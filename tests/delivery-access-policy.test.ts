import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Native Node test discovery requires the explicit .ts extension.
import { canReadAssignedDelivery, USER_ROLE } from "../src/lib/permissions.ts"

const order = {
  buyerId: "buyer",
  partnerId: "partner",
  managerId: "manager",
}

test("покупатель читает собственную сделку с обычной ролью", () => {
  assert.equal(canReadAssignedDelivery(USER_ROLE.USER, "buyer", order), true)
})

test("проверенный партнёр читает только назначенную ему сделку", () => {
  assert.equal(canReadAssignedDelivery(USER_ROLE.PARTNER, "partner", order), true)
  assert.equal(canReadAssignedDelivery(USER_ROLE.PARTNER, "another-partner", order), false)
})

test("приостановленный партнёр теряет доступ, даже если partnerId остаётся в истории", () => {
  assert.equal(canReadAssignedDelivery(USER_ROLE.VERIFIED_USER, "partner", order), false)
  assert.equal(canReadAssignedDelivery(USER_ROLE.USER, "partner", order), false)
})

test("назначенный модератор и администратор сохраняют служебный доступ", () => {
  assert.equal(canReadAssignedDelivery(USER_ROLE.MODERATOR, "manager", order), true)
  assert.equal(canReadAssignedDelivery(USER_ROLE.ADMIN, "unassigned-admin", order), true)
})

test("анонимный запрос не получает доступ", () => {
  assert.equal(canReadAssignedDelivery(USER_ROLE.ADMIN, null, order), false)
})
