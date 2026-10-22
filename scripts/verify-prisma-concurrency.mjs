// Real Prisma engine, disposable audit database only. No production fixtures.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import vm from "node:vm"
import ts from "typescript"
import * as policy from "../src/lib/prisma-connection-policy.mjs"

assert.match(process.env.DATABASE_URL || "", /^file:\/tmp\/automart-auth-audit\.[^/]+\/automart-audit\.db$/)
const require = createRequire(import.meta.url)
const source = await readFile("src/lib/prisma.ts", "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const scope = {}
function loadIndependentBundle() {
  const exports = {}
  vm.runInNewContext(compiled, { exports, module: { exports }, globalThis: scope, process: { env: { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: "production" } }, require: (name) => name === "./prisma-connection-policy.mjs" ? policy : require(name) })
  return exports.prisma
}
const client = loadIndependentBundle()
assert.equal(loadIndependentBundle(), client, "independent production bundles must share one client")
try {
  await client.$executeRawUnsafe('CREATE TABLE "_PrismaPoolAudit" ("value" INTEGER NOT NULL)')
  const modeBefore = await client.$queryRawUnsafe("PRAGMA journal_mode")
  const started = Date.now()
  await Promise.all(Array.from({ length: 8 }, (_, worker) => (async () => {
    for (let i = 0; i < 30; i++) {
      if (worker % 2 === 0) {
        await client.$transaction([
          client.$executeRawUnsafe('INSERT INTO "_PrismaPoolAudit" ("value") VALUES (1)'),
          client.$queryRawUnsafe('SELECT COUNT(*) AS total FROM "_PrismaPoolAudit"'),
        ])
      } else {
        await client.$transaction([
          client.$queryRawUnsafe('SELECT COUNT(*) AS total FROM "_PrismaPoolAudit"'),
          client.$queryRawUnsafe('SELECT SUM("value") AS total FROM "_PrismaPoolAudit"'),
        ])
      }
    }
  })()))
  const [row] = await client.$queryRawUnsafe('SELECT COUNT(*) AS total FROM "_PrismaPoolAudit"')
  assert.equal(Number(row.total), 120, "every concurrent writer must commit")
  assert.deepEqual(await client.$queryRawUnsafe("PRAGMA journal_mode"), modeBefore, "pool policy must not change journal mode")
  const [userCount] = await client.$queryRawUnsafe('SELECT COUNT(*) AS total FROM "User"')
  assert.ok(Number(userCount.total) >= 0, "application tables remain readable after mixed transactions")
  console.log(`PRISMA_CONCURRENCY_VERIFIED transactions=240 writes=120 durationMs=${Date.now() - started}`)
} finally { await client.$disconnect() }
