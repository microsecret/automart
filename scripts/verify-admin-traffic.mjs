// Exercise the real admin API with known events in a disposable database.
import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
assert.ok(process.env.NEXTAUTH_SECRET)
const db = new PrismaClient()
const results = []
const failures = []
function check(name, condition) {
  results.push({ name, ok: Boolean(condition) })
  if (!condition) failures.push(name)
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`)
}
async function cookie(user) {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 600, token: { id: user.id, sub: user.id, role: user.role } })
  return `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
}
try {
  const marker = Date.now()
  const admin = await db.user.create({ data: { name: "Аудит аналитики", email: `traffic-admin-${marker}@audit.invalid`, role: "ADMIN" } })
  const member = await db.user.create({ data: { email: `traffic-member-${marker}@audit.invalid` } })
  const auth = await cookie(admin)
  const now = new Date()
  const shifted = new Date(now.getTime() + 3 * 3600000)
  const dayStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 3 * 3600000)
  await db.visitEvent.createMany({ data: [
    { path: "/", visitorKey: "browser-a", ipHash: "private-ip-one", sessionKey: "session-a", userId: admin.id, createdAt: now },
    { path: "/listings/vehicle/audit", visitorKey: "browser-b", ipHash: "private-ip-one", sessionKey: "session-b", createdAt: now },
    { path: "/category/passenger", visitorKey: "browser-c", ipHash: "private-ip-one", sessionKey: "session-a", createdAt: now },
    { path: "/services/fuel-map", sessionKey: "legacy-session", createdAt: now },
    { path: "/news", createdAt: now },
    { path: "/", visitorKey: "browser-previous", ipHash: "private-ip-one", sessionKey: "old-session", createdAt: new Date(dayStart.getTime() - 1000) },
    { path: "/future-audit", ipHash: "future-ip", createdAt: new Date(dayStart.getTime() + 2 * 86400000) },
  ] })
  check("anonymous analytics access denied", (await fetch(`${base}/api/admin/traffic`)).status === 401)
  check("ordinary account analytics access denied", (await fetch(`${base}/api/admin/traffic`, { headers: { Cookie: await cookie(member) } })).status === 403)
  const response = await fetch(`${base}/api/admin/traffic?period=day`, { headers: { Cookie: auth } })
  const data = await response.json()
  check("administrator can load traffic", response.status === 200)
  check("IP-first identity and legacy session fallback count two visitors", data.totals?.uniqueVisitors === 2)
  check("catalogue group unions visitors across its sections", data.groups?.find((row) => row.group === "CATALOG")?.visitors === 1)
  check("catalogue group retains all three views", data.groups?.find((row) => row.group === "CATALOG")?.views === 3)
  check("unidentified events still contribute to total views", data.totals?.views === 5)
  check("daily views reconcile with total views", data.daily?.reduce((sum, row) => sum + row.views, 0) === 5)
  check("hourly views reconcile with total views", data.hourly?.reduce((sum, row) => sum + row.views, 0) === 5)
  check("path views reconcile with total views", data.topPaths?.reduce((sum, row) => sum + row.views, 0) === 5)
  check("session-only legacy visitor remains in fuel section", data.sections?.find((row) => row.key === "fuel-map")?.visitors === 1)
  check("unidentified view has no invented visitor", data.sections?.find((row) => row.key === "news")?.visitors === 0)
  check("returning identity survives browser change", data.totalsExtra?.returningVisitors === 1 && data.totalsExtra?.newVisitors === 1)
  check("bounce rate uses three sessions rather than visitor identity", data.totalsExtra?.bounceRate === 67)
  check("signed-in share uses the same visitor identity", data.totalsExtra?.signedInShare === 50)
  check("raw analytics identities never leave the API", !JSON.stringify(data).includes("private-ip-one") && !JSON.stringify(data).includes("legacy-session"))
  const statsResponse = await fetch(`${base}/api/admin/stats`, { headers: { Cookie: auth } })
  const stats = await statsResponse.json()
  check("summary and detailed report agree on visitors today", statsResponse.status === 200 && stats.traffic?.uniqueVisitorsDay === data.totals?.uniqueVisitors)
  await writeFile(process.env.TRAFFIC_AUDIT_REPORT || "/tmp/lewheel-admin-traffic-20261020.json", JSON.stringify({ mode: "isolated database; authenticated API", results, failures }, null, 2))
  assert.equal(failures.length, 0, failures.join("; "))
  console.log(`ADMIN_TRAFFIC_VERIFIED checks=${results.length}`)
} finally { await db.$disconnect() }
