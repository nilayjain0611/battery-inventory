import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/lib/database.types"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env"

const PUBLIC_PATHS = ["/login"]

/**
 * Refreshes the auth session cookie on every request and gates private routes.
 * The redirect here is a convenience; every page and action re-checks the user
 * on the server (lib/auth.ts), and the database enforces access with RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // Validates the JWT (and refreshes it when needed). Do not put code between
  // client creation and this call.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`
    return copyCookies(response, NextResponse.redirect(url))
  }

  if (signedIn && isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return copyCookies(response, NextResponse.redirect(url))
  }

  return response
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie))
  return to
}
