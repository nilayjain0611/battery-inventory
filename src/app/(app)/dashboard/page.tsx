import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import {
  BoxesIcon,
  CalendarIcon,
  FactoryIcon,
  IndianRupeeIcon,
  PackageIcon,
  PlusIcon,
  TriangleAlertIcon,
  WalletIcon,
} from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { KpiCard } from "@/components/common/kpi-card"
import { PageHeader } from "@/components/common/page-header"
import { SalesChart } from "@/components/common/sales-chart"
import { MovementBadge, StatusBadge, StockTypeBadge } from "@/components/common/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PageSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { getDashboardMetrics } from "@/lib/data/dashboard"
import { formatINR, formatINRCompact, formatQty } from "@/lib/domain/money"
import { can } from "@/lib/domain/permissions"
import { formatDate, formatDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live figures from posted invoices, purchases, production and the stock ledger."
        actions={
          <Suspense fallback={null}>
            <QuickActions />
          </Suspense>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  )
}

async function QuickActions() {
  const user = await getCurrentUser()
  return (
    <>
      {can(user.role, "purchases.create") ? (
        <Link href="/purchases/new" className={buttonVariants({ variant: "outline" })}>
          Record purchase
        </Link>
      ) : null}
      {can(user.role, "sales.create") ? (
        <Link href="/sales/new" className={buttonVariants()}>
          <PlusIcon /> New invoice
        </Link>
      ) : null}
    </>
  )
}

async function DashboardContent() {
  const m = await getDashboardMetrics()
  const byType = m.products_by_type

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sales today"
          value={formatINRCompact(m.sales_today)}
          hint={`${m.invoices_today} invoice${m.invoices_today === 1 ? "" : "s"} · ${formatDate(m.today)}`}
          icon={IndianRupeeIcon}
          href="/sales"
        />
        <KpiCard
          label="Sales this month"
          value={formatINRCompact(m.sales_month)}
          hint={`${m.invoices_month} posted invoices`}
          icon={CalendarIcon}
          href="/reports"
        />
        <KpiCard
          label="Customer receivables"
          value={formatINRCompact(m.receivables)}
          hint={Number(m.overdue_receivables) > 0 ? `${formatINR(m.overdue_receivables)} overdue` : "Nothing overdue"}
          icon={WalletIcon}
          tone={Number(m.overdue_receivables) > 0 ? "warning" : "default"}
          href="/customers"
        />
        <KpiCard
          label="Inventory value"
          value={formatINRCompact(m.inventory_value)}
          hint="At weighted-average cost"
          icon={BoxesIcon}
          href="/inventory"
        />
        <KpiCard
          label="Active products"
          value={m.total_products}
          hint={`${byType.raw_material ?? 0} raw · ${byType.manufactured ?? 0} own brand · ${byType.trading ?? 0} third-party`}
          icon={PackageIcon}
          href="/inventory/products"
        />
        <KpiCard
          label="Finished batteries in stock"
          value={formatQty(m.finished_goods_quantity)}
          hint="Own brand + third-party units"
          icon={BoxesIcon}
          href="/inventory"
        />
        <KpiCard
          label="Low-stock items"
          value={m.low_stock_count}
          hint="At or below reorder level"
          icon={TriangleAlertIcon}
          tone={m.low_stock_count > 0 ? "danger" : "default"}
          href="/inventory/products?filter=low"
        />
        <KpiCard
          label="Produced this month"
          value={formatQty(m.production_month_quantity)}
          hint={`${m.production_month_orders} completed order${m.production_month_orders === 1 ? "" : "s"} · payables ${formatINRCompact(m.payables)}`}
          icon={FactoryIcon}
          href="/manufacturing"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Sales, last 30 days" description="Posted invoice totals per day (incl. GST)" />
          <CardContent>
            <SalesChart data={m.sales_trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Low stock"
            description="Reorder soon"
            action={
              <Link href="/inventory/products?filter=low" className="text-xs text-primary hover:underline">
                View all
              </Link>
            }
          />
          {m.low_stock.length === 0 ? (
            <EmptyState title="All items above reorder level" />
          ) : (
            <ul className="divide-y">
              {m.low_stock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/inventory/products/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                      {p.name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{p.sku}</span>
                      <StockTypeBadge type={p.stock_type} />
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="tabular font-semibold text-destructive">{formatQty(p.quantity, p.uom)}</p>
                    <p className="tabular text-xs text-muted-foreground">min {formatQty(p.reorder_level)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent sales"
            action={
              <Link href="/sales" className="text-xs text-primary hover:underline">
                All invoices
              </Link>
            }
          />
          {m.recent_sales.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Invoice</TH>
                  <TH>Customer</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {m.recent_sales.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <Link href={`/sales/${s.id}`} className="font-medium text-primary hover:underline">
                        {s.invoice_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(s.invoice_date)}</p>
                    </TD>
                    <TD className="max-w-48 truncate">{s.customer_name}</TD>
                    <TDNum>{formatINR(s.grand_total)}</TDNum>
                    <TD>
                      <StatusBadge status={s.payment_status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent stock movements"
            action={
              <Link href="/inventory/movements" className="text-xs text-primary hover:underline">
                Full ledger
              </Link>
            }
          />
          {m.recent_movements.length === 0 ? (
            <EmptyState title="No stock movements yet" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Movement</TH>
                  <TH className="text-right">Qty</TH>
                  <TH>When</TH>
                </TR>
              </THead>
              <TBody>
                {m.recent_movements.map((mv) => (
                  <TR key={mv.id}>
                    <TD>
                      <p className="max-w-44 truncate font-medium">{mv.product_name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{mv.reference ?? mv.sku}</p>
                    </TD>
                    <TD>
                      <MovementBadge type={mv.movement_type} />
                    </TD>
                    <TDNum className={Number(mv.quantity) < 0 ? "text-destructive" : "text-success"}>
                      {Number(mv.quantity) > 0 ? "+" : ""}
                      {formatQty(mv.quantity)}
                    </TDNum>
                    <TD className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(mv.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  )
}
