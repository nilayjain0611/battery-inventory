import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { StockTypeBadge } from "@/components/common/status-badge"
import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardHeader } from "@/components/ui/card"
import { PageSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { getReconciliationIssues, listProducts } from "@/lib/data/inventory"
import { dec, formatINR, formatQty } from "@/lib/domain/money"
import { can } from "@/lib/domain/permissions"
import { STOCK_TYPE_LABELS, todayIST } from "@/lib/format"

export const metadata: Metadata = { title: "Stock overview" }

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Stock overview"
        description="Balances are a projection of the stock ledger and are checked against it on every load."
        actions={
          <Link href="/inventory/movements" className={buttonVariants({ variant: "outline" })}>
            View ledger
          </Link>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Overview />
      </Suspense>
    </>
  )
}

async function Overview() {
  const [user, products, issues] = await Promise.all([
    getCurrentUser(),
    listProducts({ activeOnly: true }),
    getReconciliationIssues(),
  ])
  const today = todayIST()

  const groups = (["manufactured", "trading", "raw_material"] as const).map((type) => {
    const rows = products.filter((p) => p.stock_type === type)
    return {
      type,
      rows,
      items: rows.length,
      value: rows.reduce((s, p) => s.plus(dec(p.stock_value)), dec(0)),
      low: rows.filter((p) => p.is_low_stock).length,
    }
  })
  const total = groups.reduce((s, g) => s.plus(g.value), dec(0))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CircleCheckIcon className="size-4" /> Ledger and balances reconcile for all {products.length} products.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlertIcon className="size-4" /> {issues.length} product(s) do not reconcile with the ledger:{" "}
            {issues.map((i) => i.sku).join(", ")}
          </p>
        )}
        {can(user.role, "stock.adjust") ? (
          <AdjustStockDialog
            today={today}
            products={products.map((p) => ({
              id: p.id ?? "",
              label: `${p.sku} · ${p.name}`,
              uom: p.uom ?? "",
              quantity: Number(p.quantity ?? 0),
              avgCost: Number(p.avg_cost ?? 0),
            }))}
          />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((g) => (
          <Link
            key={g.type}
            href={`/inventory/products?type=${g.type}`}
            className="rounded-lg border bg-card p-4 shadow-xs hover:border-primary/40"
          >
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{STOCK_TYPE_LABELS[g.type]}</p>
            <p className="tabular mt-2 text-2xl font-semibold">{formatINR(g.value)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {g.items} items{g.low ? ` · ${g.low} low` : ""}
            </p>
          </Link>
        ))}
        <div className="rounded-lg border bg-sidebar p-4 text-sidebar-foreground shadow-xs">
          <p className="text-xs font-medium tracking-wide uppercase opacity-70">Total inventory value</p>
          <p className="tabular mt-2 text-2xl font-semibold text-white">{formatINR(total)}</p>
          <p className="mt-0.5 text-xs opacity-70">Weighted-average cost, excl. GST</p>
        </div>
      </div>

      {groups.map((g) => (
        <Card key={g.type}>
          <CardHeader title={STOCK_TYPE_LABELS[g.type]} description={`${g.items} active items`} />
          <Table>
            <THead>
              <TR>
                <TH>Product</TH>
                <TH>Type</TH>
                <TH className="text-right">On hand</TH>
                <TH className="text-right">Reorder at</TH>
                <TH className="text-right">Avg cost</TH>
                <TH className="text-right">Value</TH>
              </TR>
            </THead>
            <TBody>
              {g.rows.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/inventory/products/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                  </TD>
                  <TD>
                    <StockTypeBadge type={p.stock_type} />
                  </TD>
                  <TDNum className={p.is_low_stock ? "font-semibold text-destructive" : ""}>{formatQty(p.quantity, p.uom)}</TDNum>
                  <TDNum className="text-muted-foreground">{formatQty(p.reorder_level)}</TDNum>
                  <TDNum>{formatINR(p.avg_cost)}</TDNum>
                  <TDNum className="font-medium">{formatINR(p.stock_value)}</TDNum>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ))}
    </div>
  )
}
