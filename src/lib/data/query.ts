import type { PostgrestError } from "@supabase/supabase-js"

import { dbErrorMessage } from "@/lib/actions/result"

/** Unwraps a Supabase response, throwing a readable error (caught by error.tsx). */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${dbErrorMessage(res.error)}`)
  if (res.data === null) throw new Error(`${what}: no data returned`)
  return res.data
}
