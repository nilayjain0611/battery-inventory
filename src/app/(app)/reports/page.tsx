import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { DownloadIcon } from "lucide-react"
import { cn } from "cn"

import { EmptyState } from "@/components/common/empty-state"
import { FilterBar, FilterField } from "@/components/common/filter-bar"
import { PageHeader } from "@/components/common/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { REPORTS, runReport, type ReportKey } from "@/lib/data/reports"
import { formatINR, formatQty } from "@/lib/domain/money"
import { STOCK_TYPE_LABELS, firstOfMonth, formatDate, param, todayIST, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Reports" }

export default function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader title="Reports" description="Every figure is queried live from posted documents and the stock ledger." />
      <Suspense fallback={<Card><TableSkeleton rows={8} /></Card>}>
        <Report searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Report({ searchParams }: { searchParams: SearchParams }) {
  await getCurrentUser()
  const sp = await searchParams
  const today = todayIST()
  const tab = (param(sp.tab) ?? "sales-date") as ReportKey
  const key: ReportKey = tab in REPORTS ? tab : "sales-date"
  const from = param(sp.from) ?? firstOfMonth(today)
  const to = param(sp.to) ?? today
  const report = await runReport(key, from, to)
  const qs = (k: string) => `?tab=${k}&from=${from}&to=${to}`

  return (
    <>
      <nav className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-card p-1" aria-label="Reports">
        {(Object.keys(REPORTS) as ReportKey[]).map((k) => (
          <Link
            key={k}
            href={`/reports${qs(k)}`}
            aria-current={k === key ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              k === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {REPORTS[k]}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <FilterBar action="/reports" resetHref={`/reports?tab=${key}`}>
          <input type="hidden" name="tab" value={key} />
          <FilterField label="From">
            <Input type="date" name="from" defaultValue={from} max={today} />
          </FilterField>
          <FilterField label="To">
            <Input type="date" name="to" defaultValue={to} max={today} />
          </FilterField>
        </FilterBar>
        <a href={`/reports/export${qs(key)}`} className={buttonVariants({ variant: "outline", className: "mb-4" })}>
          <DownloadIcon /> Export CSV
        </a>
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{REPORTS[key]}</h2>
          <p className="text-xs text-muted-foreground">
            {key === "stock" || key === "receivables" ? "Current position" : `${formatDate(from)} – ${formatDate(to)}`}
          </p>
        </div>
        {report.rows.length === 0 ? (
          <EmptyState title="No data for this period" />
        ) : (
          <Table>
            <THead>
              <TR>
                {report.columns.map((c) => (
                  <TH key={c.key} className={c.numeric || c.money ? "text-right" : undefined}>
                    {c.label}
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {report.rows.map((r, i) => (
                <TR key={i}>
                  {report.columns.map((c) =>
                    c.money ? (
                      <TDNum key={c.key}>{formatINR(r[c.key])}</TDNum>
                    ) : c.numeric ? (
                      <TDNum key={c.key}>{formatQty(r[c.key])}</TDNum>
                    ) : (
                      <TD key={c.key} className={c.key === "sku" ? "font-mono text-xs" : undefined}>
                        {c.key === "date"
                          ? formatDate(String(r[c.key]))
                          : c.key === "type"
                            ? (STOCK_TYPE_LABELS[String(r[c.key]) as keyof typeof STOCK_TYPE_LABELS] ?? r[c.key])
                            : (r[c.key] ?? "—")}
                      </TD>
                    ),
                  )}
                </TR>
              ))}
              {report.totals ? (
                <TR className="bg-muted/50 font-semibold">
                  {report.columns.map((c, i) =>
                    c.key in (report.totals ?? {}) ? (
                      <TDNum key={c.key}>{c.money ? formatINR(report.totals?.[c.key]) : formatQty(report.totals?.[c.key])}</TDNum>
                    ) : (
                      <TD key={c.key}>{i === 0 ? "Total" : ""}</TD>
                    ),
                  )}
                </TR>
              ) : null}
            </TBody>
          </Table>
        )}
        {report.note ? <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">{report.note}</p> : null}
      </Card>
    </>
  )
}
