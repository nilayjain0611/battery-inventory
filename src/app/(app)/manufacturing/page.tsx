import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { FactoryIcon, PlusIcon } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { FilterBar, FilterField } from "@/components/common/filter-bar"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardHeader } from "@/components/ui/card"
import { Select } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { listBoms, listProductionOrders } from "@/lib/data/manufacturing"
import { formatINR, formatQty } from "@/lib/domain/money"
import { can } from "@/lib/domain/permissions"
import { formatDate, param, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Manufacturing" }

export default function ManufacturingPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Manufacturing"
        description="Own-brand production: bills of materials, production orders, material consumption and costing."
        actions={
          <Suspense fallback={null}>
            <NewButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Card><TableSkeleton /></Card>}>
        <Orders searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Card className="mt-5"><TableSkeleton rows={3} /></Card>}>
        <Boms />
      </Suspense>
    </>
  )
}

async function NewButton() {
  const user = await getCurrentUser()
  if (!can(user.role, "production.manage")) return null
  return (
    <Link href="/manufacturing/new" className={buttonVariants()}>
      <PlusIcon /> New production order
    </Link>
  )
}

async function Orders({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const status = param(sp.status)
  const orders = await listProductionOrders(status)
  return (
    <>
      <FilterBar action="/manufacturing" resetHref="/manufacturing">
        <FilterField label="Status">
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </FilterField>
      </FilterBar>
      <Card>
        <CardHeader title="Production orders" />
        {orders.length === 0 ? (
          <EmptyState icon={FactoryIcon} title="No production orders" description="Plan a batch from a bill of materials." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Order</TH>
                <TH>Product</TH>
                <TH className="text-right">Planned</TH>
                <TH className="text-right">Produced</TH>
                <TH className="text-right">Material cost</TH>
                <TH className="text-right">Per unit</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {orders.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <Link href={`/manufacturing/${o.id}`} className="font-medium text-primary hover:underline">
                      {o.order_number}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatDate(o.production_date)}</p>
                  </TD>
                  <TD>
                    {o.product_name}
                    <p className="font-mono text-xs text-muted-foreground">{o.sku}</p>
                  </TD>
                  <TDNum>{formatQty(o.planned_quantity)}</TDNum>
                  <TDNum className="font-medium">{o.produced_quantity !== null ? formatQty(o.produced_quantity) : "—"}</TDNum>
                  <TDNum>{o.material_cost !== null ? formatINR(o.material_cost) : "—"}</TDNum>
                  <TDNum>{o.unit_material_cost !== null ? formatINR(o.unit_material_cost) : "—"}</TDNum>
                  <TD>
                    <StatusBadge status={o.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  )
}

async function Boms() {
  const boms = await listBoms()
  return (
    <Card className="mt-5">
      <CardHeader title="Bills of materials" description="Components consumed per finished battery. Quantities are sample recipes for the demo." />
      {boms.length === 0 ? (
        <EmptyState title="No bills of materials" />
      ) : (
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {boms.map((b) => (
            <div key={b.id} className="bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{b.product_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {b.name} · output {formatQty(b.output_quantity)}
                  </p>
                </div>
                <Link href={`/manufacturing/new?bom=${b.id}`} className="text-xs text-primary hover:underline">
                  Plan batch
                </Link>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {b.lines.map((l) => (
                  <li key={l.component_product_id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{l.name}</span>
                    <span className="tabular">{formatQty(l.quantity, l.uom)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
