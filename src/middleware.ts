import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { can } from "@/lib/permissions"

const ADMIN_PREFIX = "/admin"

function withSecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=()")

  if (request.nextUrl.protocol === "https:") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  }

  return response
}

function signInRedirect(request: NextRequest) {
  const signInUrl = new URL("/auth/signin", request.url)
  signInUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return withSecurityHeaders(NextResponse.redirect(signInUrl), request)
}

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return signInRedirect(request)

  if (request.nextUrl.pathname.startsWith(ADMIN_PREFIX) && !can(token.role, "admin:access")) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/?access=denied", request.url)), request)
  }

  return withSecurityHeaders(NextResponse.next(), request)
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
