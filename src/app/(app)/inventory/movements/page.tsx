import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowRightLeftIcon } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { FilterBar, FilterField } from "@/components/common/filter-bar"
import { PageHeader } from "@/components/common/page-header"
import { MovementBadge, StockTypeBadge } from "@/components/common/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input, Select } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getProductOptions, listMovements } from "@/lib/data/inventory"
import { formatINR, formatQty } from "@/lib/domain/money"
import { id as idSchema } from "@/lib/domain/schemas"
import { MOVEMENT_LABELS, formatDate, formatDateTime, param, sourceHref, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Stock movements" }

const PAGE = 100

export default function MovementsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Stock movements"
        description="The ledger is the source of truth: every change in stock, with the document and person behind it. Entries are never edited or deleted."
      />
      <Suspense fallback={<Card><TableSkeleton rows={10} /></Card>}>
        <Movements searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Movements({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const product = param(sp.product)
  const type = param(sp.type)
  const from = param(sp.from)
  const to = param(sp.to)
  const limit = Math.min(Number(param(sp.limit) ?? PAGE) || PAGE, 2000)
  const productId = product && idSchema.safeParse(product).success ? product : undefined

  const [{ rows, total }, products] = await Promise.all([
    listMovements({ productId, type: type && type in MOVEMENT_LABELS ? type : undefined, from, to, limit }),
    getProductOptions(),
  ])

  const moreParams = new URLSearchParams()
  Object.entries({ product, type, from, to }).forEach(([k, v]) => v && moreParams.set(k, v))
  moreParams.set("limit", String(limit + PAGE))

  return (
    <>
      <FilterBar action="/inventory/movements" resetHref="/inventory/movements">
        <FilterField label="Product">
          <Select name="product" defaultValue={productId ?? ""} className="w-64">
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id ?? ""}>
                {p.sku} · {p.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Movement type">
          <Select name="type" defaultValue={type ?? ""}>
            <option value="">All types</option>
            {Object.entries(MOVEMENT_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="From">
          <Input type="date" name="from" defaultValue={from} />
        </FilterField>
        <FilterField label="To">
          <Input type="date" name="to" defaultValue={to} />
        </FilterField>
      </FilterBar>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={ArrowRightLeftIcon} title="No movements match these filters" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Product</TH>
                <TH>Movement</TH>
                <TH>Document</TH>
                <TH className="text-right">Quantity</TH>
                <TH className="text-right">Unit cost</TH>
                <TH className="text-right">Value</TH>
                <TH>By</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((m) => {
                const href = sourceHref(m.source_type, m.source_id)
                return (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap">
                      {formatDate(m.movement_date)}
                      <p className="text-[11px] text-muted-foreground">{formatDateTime(m.created_at)}</p>
                    </TD>
                    <TD>
                      <Link href={`/inventory/products/${m.product_id}`} className="font-medium hover:underline">
                        {m.product_name}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-muted-foreground">{m.sku}</span>
                        <StockTypeBadge type={m.stock_type} />
                      </div>
                    </TD>
                    <TD>
                      <MovementBadge type={m.movement_type} />
                      {m.note ? <p className="mt-1 max-w-56 text-xs text-muted-foreground">{m.note}</p> : null}
                    </TD>
                    <TD className="font-mono text-xs">
                      {href ? (
                        <Link href={href} className="text-primary hover:underline">
                          {m.reference ?? "View"}
                        </Link>
                      ) : (
                        m.reference ?? "—"
                      )}
                    </TD>
                    <TDNum className={Number(m.quantity) < 0 ? "text-destructive" : "text-success"}>
                      {Number(m.quantity) > 0 ? "+" : ""}
                      {formatQty(m.quantity, m.uom)}
                    </TDNum>
                    <TDNum>{formatINR(m.unit_cost)}</TDNum>
                    <TDNum>{formatINR(m.value)}</TDNum>
                    <TD className="text-xs text-muted-foreground">{m.created_by_name ?? "—"}</TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {rows.length} of {total} movements
        </span>
        {rows.length < total ? (
          <Link href={`/inventory/movements?${moreParams.toString()}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Show more
          </Link>
        ) : null}
      </div>
    </>
  )
}
