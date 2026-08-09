import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasExpectedFileSignature } from "@/lib/file-signature"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const validTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid type. JPEG, PNG, WebP only." }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
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
