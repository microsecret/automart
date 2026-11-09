import { randomUUID } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"

export type FuelStationLogEntry = {
  runId: string
  source: string
  city: string
  station: string
  address: string | null
  prices: string | null
  status: string | null
  kind: string
}

export function insertFuelStationLogBatch(db: Pick<PrismaClient, "$executeRaw">, entries: FuelStationLogEntry[]) {
  // One autocommit statement. Prisma createMany opens a separate transaction
  // and can leave it active if SQLite cannot acquire the lock for COMMIT.
  const createdAt = new Date()
  const rows = entries.map((entry) => Prisma.sql`(${randomUUID()}, ${entry.runId}, ${entry.source},
    ${entry.city}, ${entry.station}, ${entry.address}, ${entry.prices}, ${entry.status}, ${entry.kind}, ${createdAt})`)
  return db.$executeRaw`INSERT INTO "FuelImportLogEntry"
    ("id", "runId", "source", "city", "station", "address", "prices", "status", "kind", "createdAt")
    VALUES ${Prisma.join(rows)}`
}
