import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { can } from "@/lib/permissions"

const ADMIN_PREFIX = "/admin"

function signInRedirect(request: NextRequest) {
  const signInUrl = new URL("/auth/signin", request.url)
  signInUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(signInUrl)
}

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return signInRedirect(request)

  if (request.nextUrl.pathname.startsWith(ADMIN_PREFIX) && !can(token.role, "admin:access")) {
    return NextResponse.redirect(new URL("/?access=denied", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/deliveries/:path*",
    "/favorites/:path*",
    "/listings/create/:path*",
    "/messages/:path*",
    "/notifications/:path*",
  ],
}
