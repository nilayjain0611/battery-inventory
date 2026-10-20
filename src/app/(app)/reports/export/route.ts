import { REPORTS, runReport, type ReportKey } from "@/lib/data/reports"
import { createClient } from "@/lib/supabase/server"

const DATE = /^\d{4}-\d{2}-\d{2}$/

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v)
  // Quote, and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) return new Response("Sign in required", { status: 401 })

  const url = new URL(request.url)
  const tab = url.searchParams.get("tab") ?? ""
  const from = url.searchParams.get("from") ?? ""
  const to = url.searchParams.get("to") ?? ""
  if (!(tab in REPORTS) || !DATE.test(from) || !DATE.test(to)) {
    return new Response("Invalid report parameters", { status: 400 })
  }

  try {
    const report = await runReport(tab as ReportKey, from, to)
    const lines = [
      report.columns.map((c) => csvCell(c.label)).join(","),
      ...report.rows.map((r) => report.columns.map((c) => csvCell(r[c.key])).join(",")),
    ]
    return new Response("﻿" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tab}_${from}_${to}.csv"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Report failed", { status: 500 })
  }
}
