import type { Metadata } from "next"
import { Suspense } from "react"

import { TaxSettings } from "@/components/settings/tax-settings"
import { PageSkeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"
import { unwrap } from "@/lib/data/query"
import { can } from "@/lib/domain/permissions"
import { todayIST } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Tax & numbering" }

export default function TaxSettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Tax />
    </Suspense>
  )
}

async function Tax() {
  const user = await getCurrentUser()
  const supabase = await createClient()
  const today = todayIST()
  const [rates, sequences] = await Promise.all([
    supabase.from("gst_rates").select("id, code, description, rate, effective_from, is_sample").order("code").order("effective_from", { ascending: false }),
    supabase.from("document_sequences").select("id, doc_type, prefix, fiscal_year, next_number, padding").order("fiscal_year", { ascending: false }).order("doc_type"),
  ])
  const rateRows = unwrap(rates, "GST rates")
  const seen = new Set<string>()
  return (
    <TaxSettings
      today={today}
      isAdmin={can(user.role, "settings.manage")}
      sequences={unwrap(sequences, "Sequences")}
      rates={rateRows.map((r) => {
        const inEffect = r.effective_from <= today && !seen.has(r.code)
        if (inEffect) seen.add(r.code)
        return { ...r, in_effect: inEffect }
      })}
    />
  )
}
