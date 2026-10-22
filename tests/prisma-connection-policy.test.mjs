import test from "node:test"
import assert from "node:assert/strict"
import { sharedPrismaClient, sqliteConnectionUrl } from "../src/lib/prisma-connection-policy.mjs"

test("SQLite keeps exactly the same file and bounded serialized pool", () => {
  const result = sqliteConnectionUrl("file:./dev.db")
  assert.equal(result.split("?")[0], "file:./dev.db")
  const query = new URLSearchParams(result.split("?")[1])
  assert.equal(query.get("connection_limit"), "1")
  assert.equal(query.get("socket_timeout"), "5")
  assert.equal(query.get("pool_timeout"), "5")
})
test("existing namespaced parameters survive; unsafe duplicate limits collapse", () => {
  const result = sqliteConnectionUrl("file:/tmp/audit%20db.db?db_name=main&connection_limit=12&connection_limit=20&pool_timeout=0")
  assert.equal(result.split("?")[0], "file:/tmp/audit%20db.db")
  const query = new URLSearchParams(result.split("?")[1])
  assert.equal(query.get("db_name"), "main")
  assert.deepEqual(query.getAll("connection_limit"), ["1"])
  assert.equal(query.get("pool_timeout"), "5")
})
test("policy is idempotent", () => {
  const result = sqliteConnectionUrl("file:./dev.db?socket_timeout=0")
  assert.equal(sqliteConnectionUrl(result), result)
})
test("other database connectors and absent configuration are untouched", () => {
  for (const url of [undefined, "", "postgresql://localhost/db?connection_limit=8", "mysql://localhost/db"]) assert.equal(sqliteConnectionUrl(url), url)
})
test("all callers in a runtime share one client", () => {
  const scope = {}; let created = 0
  const factory = () => ({ number: ++created })
  const first = sharedPrismaClient(scope, factory)
  assert.equal(sharedPrismaClient(scope, factory), first)
  assert.equal(created, 1)
})
test("an existing client is reused without reconnecting", () => {
  const client = {}, scope = { prisma: client }
  assert.equal(sharedPrismaClient(scope, () => { throw new Error("must not run") }), client)
})
test("failed creation does not poison the singleton", () => {
  const scope = {}
  assert.throws(() => sharedPrismaClient(scope, () => { throw new Error("failed") }))
  const client = {}
  assert.equal(sharedPrismaClient(scope, () => client), client)
})
test("separate runtimes keep separate clients", () => {
  assert.notEqual(sharedPrismaClient({}, () => ({})), sharedPrismaClient({}, () => ({})))
})
