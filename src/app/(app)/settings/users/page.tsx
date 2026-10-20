import type { Metadata } from "next"
import { Suspense } from "react"

import { UsersAdmin } from "@/components/settings/users-admin"
import { PageSkeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"
import { unwrap } from "@/lib/data/query"
import { can } from "@/lib/domain/permissions"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Users & roles" }

export default function UsersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Users />
    </Suspense>
  )
}

async function Users() {
  const user = await getCurrentUser()
  const supabase = await createClient()
  const [members, profiles] = await Promise.all([
    supabase.from("company_memberships").select("id, user_id, role, can_record_receipts, is_active").order("created_at"),
    supabase.from("profiles").select("id, full_name, email"),
  ])
  const byId = new Map(unwrap(profiles, "Profiles").map((p) => [p.id, p]))
  return (
    <UsersAdmin
      isAdmin={can(user.role, "settings.manage")}
      canCreate={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
      members={unwrap(members, "Members").map((m) => ({
        ...m,
        name: byId.get(m.user_id)?.full_name || "—",
        email: byId.get(m.user_id)?.email ?? "",
        is_self: m.user_id === user.id,
      }))}
    />
  )
}
