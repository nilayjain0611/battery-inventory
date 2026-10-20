import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"
import { SUPABASE_URL } from "@/lib/env"

/**
 * Service-role client. Bypasses RLS, so it is used for exactly one thing:
 * creating auth users from Settings → Users, after the caller has been
 * verified as an admin. Never import this from client code.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
