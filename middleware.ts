// middleware.ts
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { nextUrl } = req

  // If the user is not logged in and trying to access a protected route,
  // redirect them to the signin page
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/signin", nextUrl))
  }

  // Allow logged-in users to access protected routes
  return NextResponse.next()
})

// MATCHER CONFIG
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - signin (auth page)
     * - public (public files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|signin|public).*)",
  ],
}
