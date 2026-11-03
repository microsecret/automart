// Server only: real HTTP, NextAuth JWTs and Prisma on a disposable audit DB.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.match(process.env.DATABASE_URL || "", /^file:\/tmp\/automart-auth-audit\.[\w-]+\/automart-audit\.db$/)
assert.ok(process.env.NEXTAUTH_SECRET, "isolated auth secret required")

const db = new PrismaClient()
const checks = []
const marker = `session-audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`
const initialPassword = "AuditOriginal-2026!"
const nextPassword = "AuditReplacement-2026!"

function check(name, condition) {
  assert.ok(condition, name)
  checks.push(name)
  console.log(`PASS ${name}`)
}

async function sessionCookie(user, version = 0) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 1800,
    token: {
      id: user.id, sub: user.id, role: user.role, accountStatus: "ACTIVE", checkedAt: Date.now(),
      ...(version === null ? {} : { sessionVersion: version }),
    },
  })
  return `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
}

async function request(path, cookie, options = {}) {
  const headers = new Headers(options.headers || {})
  if (cookie) headers.set("Cookie", cookie)
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  const response = await fetch(`${base}${path}`, {
    ...options, headers, redirect: "manual", signal: AbortSignal.timeout(20000),
  })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

function responseCookies(response) {
  // Node's server runtime exposes individual Set-Cookie values, including
  // separate CSRF/session cookies. Values remain in memory and never in logs.
  assert.equal(typeof response.headers.getSetCookie, "function", "server runtime must expose Set-Cookie separately")
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0])
}

async function passwordLogin(email, password) {
  const csrf = await fetch(`${base}/api/auth/csrf`, { signal: AbortSignal.timeout(20000) })
  const csrfBody = await csrf.json()
  assert.ok(csrfBody.csrfToken, "CSRF challenge available")
  const response = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: responseCookies(csrf).join("; ") },
    body: new URLSearchParams({ csrfToken: csrfBody.csrfToken, identifier: email, password, callbackUrl: `${base}/dashboard`, json: "true" }),
  })
  return responseCookies(response).filter((value) => /^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?=/.test(value)).join("; ")
}

try {
  const owner = await db.user.create({ data: {
    email: `${marker}-owner@audit.invalid`, name: "Аудит сброса пароля", role: "USER",
    emailVerified: new Date(), hashedPassword: await bcrypt.hash(initialPassword, 4),
  } })
  const seller = await db.user.create({ data: {
    email: `${marker}-seller@audit.invalid`, name: "Тестовый продавец", phone: "+70000000001",
  } })
  const category = await db.category.create({ data: { name: `${marker}-cars`, icon: "car" } })
  const vehicle = await db.vehicle.create({ data: {
    make: "Toyota", model: "RAV4", year: 2024, price: 1000000, mileage: 18000,
    fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SUV", color: "Белый",
    power: 199, engineVolume: 2, driveType: "AWD", condition: "EXCELLENT", location: "Москва",
    vehicleType: "CAR", steeringWheel: "LEFT", ownersCount: 1, documentsStatus: "CLEAN",
    damageInfo: "NONE", sellerType: "OWNER", availability: "IN_STOCK", customsCleared: true,
    description: "Изолированная проверка отзыва сессий", images: "[]",
    userId: seller.id, categoryId: category.id,
    listings: { create: {
      title: "Изолированная проверка доступа к контакту", price: 1000000, status: "ACTIVE", userId: seller.id,
    } },
  }, include: { listings: true } })
  const listing = vehicle.listings[0]
  const oldCookie = await sessionCookie(owner, 0)
  const legacyCookie = await sessionCookie(owner, null)
  check("current version JWT can access protected API before reset", (await request("/api/favorites?countOnly=true", oldCookie)).status === 200)
  check("legacy versionless JWT remains compatible before first reset", (await request("/api/favorites?countOnly=true", legacyCookie)).status === 200)
  check("active buyer can reveal seller contact before reset", (await request(`/api/listings/${listing.id}`, oldCookie, { method: "POST" })).status === 200)

  const rawToken = crypto.randomBytes(32).toString("base64url")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  await db.verificationToken.create({ data: {
    identifier: `password-reset:${owner.email}`, token: tokenHash, expires: new Date(Date.now() + 3600000),
  } })
  const reset = await request("/api/auth/reset-password", null, { method: "POST", body: JSON.stringify({ token: rawToken, password: nextPassword }) })
  check("real reset endpoint accepts valid one-time token", reset.status === 200 && reset.body?.ok === true)
  const changed = await db.user.findUniqueOrThrow({ where: { id: owner.id } })
  check("password reset increments durable session version", changed.sessionVersion === 1)
  check("password reset stores the replacement password", await bcrypt.compare(nextPassword, changed.hashedPassword || ""))
  check("password reset invalidates previous password", !await bcrypt.compare(initialPassword, changed.hashedPassword || ""))
  check("password reset consumes hashed token", await db.verificationToken.count({ where: { token: tokenHash } }) === 0)
  check("old version JWT is rejected immediately after reset", (await request("/api/favorites?countOnly=true", oldCookie)).status === 401)
  check("legacy versionless JWT is rejected immediately after reset", (await request("/api/favorites?countOnly=true", legacyCookie)).status === 401)
  check("revoked JWT cannot mutate favorites", (await request("/api/favorites", oldCookie, { method: "POST", body: JSON.stringify({ listingId: listing.id }) })).status === 401)
  check("revoked JWT cannot remove favorites", (await request(`/api/favorites?listingId=${listing.id}`, oldCookie, { method: "DELETE" })).status === 401)
  check("revoked JWT cannot reach upload parsing or file writes", (await request("/api/upload", oldCookie, { method: "POST" })).status === 401)
  const deniedContact = await request(`/api/listings/${listing.id}`, oldCookie, { method: "POST" })
  check("revoked JWT cannot reveal seller phone", deniedContact.status === 401 && !deniedContact.body?.phone)
  check("fresh version JWT works after reset", (await request("/api/favorites?countOnly=true", await sessionCookie(owner, 1))).status === 200)
  const freshLogin = await passwordLogin(owner.email, nextPassword)
  check("real credentials login returns a fresh session after reset", freshLogin.length > 0)
  check("real credentials provider binds fresh JWT to current version", (await request("/api/favorites?countOnly=true", freshLogin)).status === 200)
  const reused = await request("/api/auth/reset-password", null, { method: "POST", body: JSON.stringify({ token: rawToken, password: "AuditUnwanted-2026!" }) })
  check("reset token cannot be reused", reused.status === 400)
  check("reused token does not increment version or change password", (await db.user.findUniqueOrThrow({ where: { id: owner.id } })).sessionVersion === 1)

  for (const status of ["RESTRICTED", "BANNED"]) {
    await db.user.update({ where: { id: owner.id }, data: { accountStatus: status } })
    const invalid = await request(`/api/listings/${listing.id}`, freshLogin, { method: "POST" })
    check(`${status} account with an existing JWT cannot reveal seller phone`, invalid.status === 401 && !invalid.body?.phone)
    check(`${status} account cannot reach public file upload`, (await request("/api/upload", freshLogin, { method: "POST" })).status === 401)
  }
  const deleted = await db.user.create({ data: { email: `${marker}-deleted@audit.invalid`, name: "Удалённый тестовый пользователь" } })
  const deletedCookie = await sessionCookie(deleted, 0)
  await db.user.delete({ where: { id: deleted.id } })
  const deletedContact = await request(`/api/listings/${listing.id}`, deletedCookie, { method: "POST" })
  check("deleted account JWT cannot reveal seller phone", deletedContact.status === 401 && !deletedContact.body?.phone)
  check("deleted account cannot reach public file upload", (await request("/api/upload", deletedCookie, { method: "POST" })).status === 401)

  console.log(`SESSION_REVOCATION_VERIFIED checks=${checks.length}`)
} finally {
  // The runner discards the entire audit database, including these fixtures.
  await db.$disconnect()
}
