import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, phone, email, city, comment } = body
    if (!name?.trim() || !phone?.trim()) return NextResponse.json({ error: "Имя и телефон обязательны" }, { status: 400 })

    const listing = await prisma.auctionListing.findUnique({ where: { id }, select: { id: true } })
    if (!listing) return NextResponse.json({ error: "Лот не найден" }, { status: 404 })

    const inquiry = await prisma.auctionInquiry.create({
      data: {
        auctionListingId: id,
        name: name.trim(), phone: phone.trim(),
        email: email?.trim() || null, city: city?.trim() || null,
        comment: comment?.trim() || null,
      },
    })
    return NextResponse.json({ success: true, inquiry }, { status: 201 })
  } catch (error) {
    console.error("Inquiry error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
