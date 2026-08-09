import { NextRequest, NextResponse } from "next/server"
import { verifyEmailToken } from "@/lib/emailVerification"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const user = token ? await verifyEmailToken(token) : null
  const redirectUrl = new URL("/auth/signin", request.url)
  redirectUrl.searchParams.set("verified", user ? "1" : "0")
  return NextResponse.redirect(redirectUrl)
}
