import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { HistoryIcon, PencilIcon } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { MovementBadge, StatusBadge, StockTypeBadge } from "@/components/common/status-badge"
import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PageSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { getProduct, getProductMovements } from "@/lib/data/inventory"
import { dec, formatINR, formatQty } from "@/lib/domain/money"
import { can } from "@/lib/domain/permissions"
import { id as idSchema } from "@/lib/domain/schemas"
import { formatDate, formatDateTime, sourceHref, todayIST } from "@/lib/format"

export const metadata: Metadata = { title: "Product" }

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductDetail params={params} />
    </Suspense>
  )
}

async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!idSchema.safeParse(id).success) notFound()
  const [user, product, movements] = await Promise.all([getCurrentUser(), getProduct(id), getProductMovements(id)])
  if (!product) notFound()

  // Running balance from the ledger, oldest first: explains every unit on hand.
  let running = dec(0)
  const withBalance = movements.map((m) => {
    running = running.plus(dec(m.quantity))
    return { ...m, balance: running }
  })
  const ledgerTotal = running
  const reconciles = ledgerTotal.eq(dec(product.quantity))

  return (
    <>
      <PageHeader
        back={{ href: "/inventory/products", label: "Products" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {product.name} <StockTypeBadge type={product.stock_type} />
            {!product.is_active ? <StatusBadge status="inactive" /> : null}
          </span>
        }
        description={
          <span className="font-mono text-xs">
            {product.sku} · HSN {product.hsn_code ?? "—"} · {product.gst_rate_code} · {product.brand_name ?? "No brand"}
          </span>
        }
        actions={
          <>
            {can(user.role, "stock.adjust") ? (
              <AdjustStockDialog
                today={todayIST()}
                defaultProductId={product.id ?? undefined}
                products={[
                  {
                    id: product.id ?? "",
                    label: `${product.sku} · ${product.name}`,
                    uom: product.uom ?? "",
                    quantity: Number(product.quantity ?? 0),
                    avgCost: Number(product.avg_cost ?? 0),
                  },
                ]}
              />
            ) : null}
            {can(user.role, "products.manage") ? (
              <Link href={`/inventory/products/${product.id}/edit`} className={buttonVariants()}>
                <PencilIcon /> Edit
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="On hand" value={formatQty(product.quantity, product.uom)} danger={!!product.is_low_stock} />
        <Stat label="Reorder level" value={formatQty(product.reorder_level, product.uom)} />
        <Stat label="Average cost" value={formatINR(product.avg_cost)} />
        <Stat label="Stock value" value={formatINR(product.stock_value)} />
        <Stat
          label={product.stock_type === "raw_material" ? "Purchase price" : "Retail / wholesale"}
          value={
            product.stock_type === "raw_material"
              ? formatINR(product.purchase_price)
              : `${formatINR(product.retail_price)} / ${formatINR(product.wholesale_price)}`
          }
        />
      </div>

      {product.description ? <p className="mt-4 text-sm text-muted-foreground">{product.description}</p> : null}

      <Card className="mt-5">
        <CardHeader
          title="Stock history"
          description={
            reconciles
              ? `Ledger total ${formatQty(ledgerTotal, product.uom)} matches the balance on hand.`
              : `Warning: ledger total ${formatQty(ledgerTotal)} differs from the balance ${formatQty(product.quantity)}.`
          }
          action={
            <Link href={`/inventory/movements?product=${product.id}`} className="text-xs text-primary hover:underline">
              Open in ledger
            </Link>
          }
        />
        {withBalance.length === 0 ? (
          <EmptyState icon={HistoryIcon} title="No stock movements yet" description="Purchases, production and sales will appear here." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Movement</TH>
                <TH>Document</TH>
                <TH className="text-right">Quantity</TH>
                <TH className="text-right">Unit cost</TH>
                <TH className="text-right">Balance</TH>
                <TH>By</TH>
              </TR>
            </THead>
            <TBody>
              {[...withBalance].reverse().map((m) => {
                const href = sourceHref(m.source_type, m.source_id)
                return (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap">
                      {formatDate(m.movement_date)}
                      <p className="text-[11px] text-muted-foreground">{formatDateTime(m.created_at)}</p>
                    </TD>
                    <TD>
                      <MovementBadge type={m.movement_type} />
                      {m.note ? <p className="mt-1 max-w-64 text-xs text-muted-foreground">{m.note}</p> : null}
                    </TD>
                    <TD className="font-mono text-xs">
                      {href && m.source_type !== "opening" ? (
                        <Link href={href} className="text-primary hover:underline">
                          {m.reference}
                        </Link>
                      ) : (
                        m.reference ?? "—"
                      )}
                    </TD>
                    <TDNum className={Number(m.quantity) < 0 ? "text-destructive" : "text-success"}>
                      {Number(m.quantity) > 0 ? "+" : ""}
                      {formatQty(m.quantity)}
                    </TDNum>
                    <TDNum>{formatINR(m.unit_cost)}</TDNum>
                    <TDNum className="font-medium">{formatQty(m.balance)}</TDNum>
                    <TD className="text-xs text-muted-foreground">{m.created_by_name ?? "—"}</TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  )
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`tabular mt-1 text-lg font-semibold ${danger ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
