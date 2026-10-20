import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/database.types"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env"

/**
 * Supabase client bound to the signed-in user's session (from cookies).
 * Every query runs as that user, so row-level security applies.
 * Create one per request; never share across requests.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session on every request, so this is safe.
        }
      },
    },
  })
}
