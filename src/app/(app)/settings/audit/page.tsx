import type { Metadata } from "next"
import { Suspense } from "react"

import { EmptyState, NotAllowed } from "@/components/common/empty-state"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { TableSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table"
import { getUserWith } from "@/lib/auth"
import { unwrap } from "@/lib/data/query"
import { formatDateTime } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Audit log" }

export default function AuditPage() {
  return (
    <Suspense fallback={<Card><TableSkeleton rows={10} /></Card>}>
      <Audit />
    </Suspense>
  )
}

function summarise(details: unknown): string {
  if (!details || typeof details !== "object") return ""
  const d = details as Record<string, unknown>
  if (d.changes && typeof d.changes === "object") {
    return Object.entries(d.changes as Record<string, { from: unknown; to: unknown }>)
      .map(([k, v]) => `${k}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}`)
      .join("; ")
  }
  const keys = ["number", "sku", "reason", "grand_total", "amount", "delta", "produced", "quantity"]
  return keys.filter((k) => d[k] !== undefined && d[k] !== null).map((k) => `${k}: ${String(d[k])}`).join(" · ")
}

async function Audit() {
  const { allowed } = await getUserWith("audit.view")
  if (!allowed) return <NotAllowed what="view the audit log" />
  const supabase = await createClient()
  const [logs, profiles] = await Promise.all([
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("profiles").select("id, full_name"),
  ])
  const names = new Map(unwrap(profiles, "Profiles").map((p) => [p.id, p.full_name]))
  const rows = unwrap(logs, "Audit log")
  return (
    <Card>
      {rows.length === 0 ? (
        <EmptyState title="No audit entries yet" />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Who</TH>
              <TH>Action</TH>
              <TH>Record</TH>
              <TH>Details</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="text-xs whitespace-nowrap">{formatDateTime(r.created_at)}</TD>
                <TD className="text-sm">{r.actor_id ? (names.get(r.actor_id) ?? "—") : "System"}</TD>
                <TD>
                  <Badge tone={r.action === "cancel" || r.action === "delete" ? "danger" : r.action === "update" ? "warning" : "neutral"}>{r.action}</Badge>
                </TD>
                <TD className="text-xs">{r.entity_type.replace(/_/g, " ")}</TD>
                <TD className="max-w-xl truncate text-xs text-muted-foreground" title={summarise(r.details)}>
                  {summarise(r.details)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  )
}
