import { redirect } from "next/navigation"
import { cache } from "react"

import { can, type AppRole, type Capability } from "@/lib/domain/permissions"
import { createClient } from "@/lib/supabase/server"

export interface CurrentUser {
  id: string
  email: string
  fullName: string
  role: AppRole
  companyId: string
  companyName: string
  canRecordReceipts: boolean
}

/**
 * Data Access Layer entry point. Verifies the session (JWT validated by
 * Supabase) and loads the caller's company membership. Deduplicated per
 * request. Redirects to /login when signed out.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect("/login")

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("company_memberships")
      .select("role, can_record_receipts, company_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
  ])
  if (!membership) redirect("/no-access")

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", membership.company_id)
    .maybeSingle()

  return {
    id: userId,
    email: profile?.email ?? String(claimsData?.claims?.email ?? ""),
    fullName: profile?.full_name || String(claimsData?.claims?.email ?? "User"),
    role: membership.role,
    companyId: membership.company_id,
    companyName: company?.name ?? "",
    canRecordReceipts: membership.can_record_receipts,
  }
})

/** For pages: returns the user if they hold the capability, otherwise null. */
export async function getUserWith(capability: Capability): Promise<{ user: CurrentUser; allowed: boolean }> {
  const user = await getCurrentUser()
  return { user, allowed: can(user.role, capability) }
}
