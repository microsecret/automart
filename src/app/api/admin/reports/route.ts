import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const REPORT_STATUSES = new Set(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"])

type ListingReportRow = {
  id: string
  reason: string
  comment: string | null
  status: string
  createdAt: Date
  reviewedAt: Date | null
  listingId: string
  listingTitle: string
  listingStatus: string
  reporterId: string
  reporterName: string | null
  reporterEmail: string | null
  reviewerName: string | null
}

async function requireModerator() {
  const session = await getServerSession(authOptions)
  if (!session || !can(session.user?.role, "listing:moderate")) return null
  return session
}

/** Lists reports without exposing them to non-moderators. */
export async function GET() {
  try {
    const session = await requireModerator()
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const reports = await prisma.$queryRaw<ListingReportRow[]>`
      SELECT
        r."id", r."reason", r."comment", r."status", r."createdAt", r."reviewedAt",
        l."id" AS "listingId", l."title" AS "listingTitle", l."status" AS "listingStatus",
        reporter."id" AS "reporterId", reporter."name" AS "reporterName", reporter."email" AS "reporterEmail",
        reviewer."name" AS "reviewerName"
      FROM "ListingReport" r
      INNER JOIN "Listing" l ON l."id" = r."listingId"
      INNER JOIN "User" reporter ON reporter."id" = r."reporterId"
      LEFT JOIN "User" reviewer ON reviewer."id" = r."reviewerId"
      ORDER BY
        CASE r."status"
          WHEN 'OPEN' THEN 0
          WHEN 'IN_REVIEW' THEN 1
          WHEN 'RESOLVED' THEN 2
          ELSE 3
        END,
        r."createdAt" DESC
      LIMIT 100
    `

    return NextResponse.json({ reports })
  } catch (error) {
    console.error("Admin reports list error:", error)
    return NextResponse.json({ error: "Не удалось загрузить жалобы" }, { status: 500 })
  }
}

/** Saves a moderator decision and notifies only the user who filed the report. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireModerator()
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json().catch(() => null)
    const id = typeof body?.id === "string" ? body.id : ""
    const status = typeof body?.status === "string" ? body.status : ""
    if (!id || !REPORT_STATUSES.has(status)) {
      return NextResponse.json({ error: "Некорректные параметры жалобы" }, { status: 400 })
    }

    const reports = await prisma.$queryRaw<Array<Pick<ListingReportRow, "id" | "reporterId" | "listingTitle">>>`
      SELECT r."id", r."reporterId", l."title" AS "listingTitle"
      FROM "ListingReport" r
      INNER JOIN "Listing" l ON l."id" = r."listingId"
      WHERE r."id" = ${id}
      LIMIT 1
    `
    const report = reports[0]
    if (!report) return NextResponse.json({ error: "Жалоба не найдена" }, { status: 404 })

    const isTerminal = status === "RESOLVED" || status === "DISMISSED"
    const now = new Date()
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "ListingReport"
        SET
          "status" = ${status},
          "reviewedAt" = ${isTerminal ? now : null},
          "reviewerId" = ${isTerminal ? session.user.id : null},
          "updatedAt" = ${now}
        WHERE "id" = ${id}
      `

      if (isTerminal) {
        await tx.notification.create({
          data: {
            userId: report.reporterId,
            type: "INFO",
            title: status === "RESOLVED" ? "Жалоба рассмотрена" : "Жалоба отклонена",
            content: status === "RESOLVED"
              ? `Модерация рассмотрела жалобу на «${report.listingTitle}».`
              : `По жалобе на «${report.listingTitle}» нарушений не выявлено.`,
            relatedId: id,
            relatedType: "LISTING_REPORT",
          },
        })
      }
    })

    return NextResponse.json({ id, status })
  } catch (error) {
    console.error("Admin report moderation error:", error)
    return NextResponse.json({ error: "Не удалось обновить жалобу" }, { status: 500 })
  }
}
