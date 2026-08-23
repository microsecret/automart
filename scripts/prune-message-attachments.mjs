#!/usr/bin/env node

import { PrismaClient } from "@prisma/client"
import { readdir, stat, unlink } from "node:fs/promises"
import path from "node:path"
import {
  isSafePrivateMessageStorageKey,
  parsePrivateFileRetentionOptions,
  selectOrphanedPrivateFiles,
} from "../src/lib/private-file-retention.mjs"

const prisma = new PrismaClient()
const LOOKUP_BATCH = 400

async function scanCandidates(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === "ENOENT") return { candidates: [], ignored: 0 }
    throw error
  }

  const candidates = []
  let ignored = 0

  for (const entry of entries) {
    if (!entry.isFile() || !isSafePrivateMessageStorageKey(entry.name)) {
      ignored += 1
      continue
    }

    try {
      const details = await stat(path.join(directory, entry.name))
      candidates.push({ storageKey: entry.name, modifiedAtMs: details.mtimeMs })
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }
  }

  return { candidates, ignored }
}

async function referencedKeys(candidates) {
  const referenced = new Set()
  for (let index = 0; index < candidates.length; index += LOOKUP_BATCH) {
    const batch = candidates.slice(index, index + LOOKUP_BATCH)
    const rows = await prisma.messageAttachment.findMany({
      where: { storageKey: { in: batch.map((candidate) => candidate.storageKey) } },
      select: { storageKey: true },
    })
    for (const row of rows) referenced.add(row.storageKey)
  }
  return referenced
}

async function main() {
  const options = parsePrivateFileRetentionOptions(process.argv.slice(2))
  const directory = path.resolve(process.env.MESSAGE_ATTACHMENTS_PATH || path.join(process.cwd(), "data", "message-attachments"))
  if (directory === path.parse(directory).root || directory === path.resolve(process.cwd())) {
    throw new Error("Refusing to scan a filesystem or project root as the private attachment directory")
  }
  const scanned = await scanCandidates(directory)
  const referenced = await referencedKeys(scanned.candidates)
  const cutoffMs = Date.now() - options.minAgeHours * 60 * 60 * 1000
  const orphaned = selectOrphanedPrivateFiles(scanned.candidates, referenced, cutoffMs)
  let removed = 0

  if (options.apply) {
    for (const candidate of orphaned) {
      try {
        await unlink(path.join(directory, candidate.storageKey))
        removed += 1
      } catch (error) {
        if (error?.code !== "ENOENT") throw error
      }
    }
  }

  console.log(JSON.stringify({
    success: true,
    mode: options.apply ? "apply" : "dry-run",
    minAgeHours: options.minAgeHours,
    scanned: scanned.candidates.length,
    referenced: referenced.size,
    young: scanned.candidates.filter((candidate) => candidate.modifiedAtMs >= cutoffMs).length,
    orphaned: orphaned.length,
    removed,
    ignored: scanned.ignored,
  }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
