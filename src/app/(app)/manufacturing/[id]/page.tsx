import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { CancelButton } from "@/components/documents/cancel-button"
import { CompleteProductionForm } from "@/components/manufacturing/complete-production-form"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PageSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { cancelProductionOrder } from "@/lib/actions/manufacturing"
import { getCurrentUser } from "@/lib/auth"
import { getProductionOrder } from "@/lib/data/manufacturing"
import { getCompany } from "@/lib/data/reference"
import { dec, formatINR, formatQty } from "@/lib/domain/money"
import { can } from "@/lib/domain/permissions"
import { id as idSchema } from "@/lib/domain/schemas"
import { formatDate, formatDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Production order" }

export default function ProductionOrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrderDetail params={params} />
    </Suspense>
  )
}

async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!idSchema.safeParse(id).success) notFound()
  const [user, data, company] = await Promise.all([getCurrentUser(), getProductionOrder(id), getCompany()])
  if (!data) notFound()
  const { order: o, materials } = data
  const canManage = can(user.role, "production.manage")
  const overhead = o.status === "completed" ? o.overhead_estimate_per_unit : company.overhead_per_unit_estimate

  return (
    <>
      <PageHeader
        back={{ href: "/manufacturing", label: "Manufacturing" }}
        title={
          <span className="flex items-center gap-2">
            {o.order_number} <StatusBadge status={o.status} />
          </span>
        }
        description={
          <>
            <Link href={`/inventory/products/${o.product_id}`} className="hover:underline">
              {o.product_name}
            </Link>{" "}
            · {o.bom_name} · {formatDate(o.production_date)}
          </>
        }
        actions={
          o.status === "draft" && canManage ? (
            <CancelButton
              id={id}
              action={cancelProductionOrder}
              label="Cancel order"
              title={`Cancel ${o.order_number}?`}
              description="Draft orders have not moved any stock, so cancelling only closes the plan."
            />
          ) : null
        }
      />

      {o.notes ? <p className="mb-4 text-sm whitespace-pre-line text-muted-foreground">{o.notes}</p> : null}

      {o.status === "draft" ? (
        canManage ? (
          <CompleteProductionForm
            orderId={id}
            orderNumber={o.order_number ?? ""}
            productName={o.product_name ?? ""}
            planned={Number(o.planned_quantity ?? 0)}
            overheadEstimate={overhead === null ? null : Number(overhead)}
            materials={materials.map((m) => ({
              product_id: m.product_id,
              sku: m.product?.sku ?? "",
              name: m.product?.name ?? "",
              uom: m.product?.uom ?? "",
              expected: Number(m.expected_quantity),
              available: Number(m.product?.quantity ?? 0),
              avg_cost: Number(m.product?.avg_cost ?? 0),
            }))}
          />
        ) : (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              This order is waiting to be completed by the production team.
            </CardContent>
          </Card>
        )
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardHeader title="Material consumption" />
            <Table>
              <THead>
                <TR>
                  <TH>Material</TH>
                  <TH className="text-right">Expected</TH>
                  <TH className="text-right">Actual</TH>
                  <TH className="text-right">Variance</TH>
                  <TH className="text-right">Unit cost</TH>
                  <TH className="text-right">Cost</TH>
                </TR>
              </THead>
              <TBody>
                {materials.map((m) => {
                  const variance = dec(m.actual_quantity ?? 0).minus(m.expected_quantity)
                  return (
                    <TR key={m.id}>
                      <TD>
                        {m.product?.name}
                        <p className="font-mono text-xs text-muted-foreground">{m.product?.sku}</p>
                      </TD>
                      <TDNum>{formatQty(m.expected_quantity, m.product?.uom)}</TDNum>
                      <TDNum className="font-medium">{m.actual_quantity !== null ? formatQty(m.actual_quantity, m.product?.uom) : "—"}</TDNum>
                      <TDNum className={variance.gt(0) ? "text-destructive" : variance.lt(0) ? "text-success" : "text-muted-foreground"}>
                        {o.status === "completed" ? `${variance.gt(0) ? "+" : ""}${formatQty(variance)}` : "—"}
                      </TDNum>
                      <TDNum>{m.unit_cost !== null ? formatINR(m.unit_cost) : "—"}</TDNum>
                      <TDNum>{m.total_cost !== null ? formatINR(m.total_cost) : "—"}</TDNum>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
            {o.wastage_notes ? (
              <p className="border-t px-4 py-3 text-sm">
                <span className="font-medium">Wastage notes: </span>
                <span className="text-muted-foreground">{o.wastage_notes}</span>
              </p>
            ) : null}
          </Card>
          {o.status === "completed" ? (
            <Card>
              <CardHeader title="Costing" />
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <Row label="Planned" value={formatQty(o.planned_quantity)} />
                  <Row label="Produced" value={formatQty(o.produced_quantity)} />
                  <Row label="Material cost" value={formatINR(o.material_cost)} />
                  <Row label="Material cost / unit" value={formatINR(o.unit_material_cost)} />
                  <Row
                    label="Labour / overhead"
                    value={o.overhead_estimate_per_unit !== null ? `${formatINR(o.overhead_estimate_per_unit)} /unit (estimate)` : "Not configured"}
                  />
                </dl>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Finished stock is valued at material cost. Labour and overhead are estimates for information only.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">Completed {formatDateTime(o.completed_at)}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  )
}
