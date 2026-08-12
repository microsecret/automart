import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasExpectedFileSignature } from "@/lib/file-signature"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const MAX_FILE_BYTES = 10 * 1024 * 1024
// A multipart body has a small envelope around the file. This stops clearly
// oversized requests before Next buffers and parses them in memory.
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userLimit = rateLimit(`upload:user:${session.user.id}`, { windowMs: 60 * 60_000, maxRequests: 12 })
    const ipLimit = rateLimit(`upload:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 40 })
    const limit = !userLimit.success ? userLimit : ipLimit
    if (!limit.success) {
      return NextResponse.json(
        { error: "Слишком много загрузок. Попробуйте позже." },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }

    const declaredLength = Number(request.headers.get("content-length"))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
      return NextResponse.json({ error: "Max 10MB" }, { status: 413 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const validTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid type. JPEG, PNG, WebP only." }, { status: 400 })
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Max 10MB" }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    if (!hasExpectedFileSignature(file.type, bytes)) {
      return NextResponse.json({ error: "File content does not match its declared type" }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads")
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

    const extensionByMime: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }
    const filename = `${randomUUID()}.${extensionByMime[file.type]}`
    const filepath = path.join(uploadDir, filename)

    await writeFile(filepath, bytes)

    return NextResponse.json({ url: `/uploads/${filename}` })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
