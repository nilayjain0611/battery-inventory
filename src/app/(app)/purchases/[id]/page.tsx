import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { CancelButton } from "@/components/documents/cancel-button"
import { TaxSummary } from "@/components/documents/tax-summary"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PageSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { cancelPurchase } from "@/lib/actions/purchases"
import { getCurrentUser } from "@/lib/auth"
import { getPurchase } from "@/lib/data/purchases"
import { dec, formatINR, formatQty } from "@/lib/domain/money"
import { can } from "@/lib/domain/permissions"
import { id as idSchema } from "@/lib/domain/schemas"
import { PAYMENT_METHOD_LABELS, formatDate, formatDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Purchase" }

export default function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PurchaseDetail params={params} />
    </Suspense>
  )
}

async function PurchaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!idSchema.safeParse(id).success) notFound()
  const [user, data] = await Promise.all([getCurrentUser(), getPurchase(id)])
  if (!data) notFound()
  const { purchase: p, lines, payments } = data
  const posted = p.status === "posted"

  return (
    <>
      <PageHeader
        back={{ href: "/purchases", label: "Purchases" }}
        title={
          <span className="flex items-center gap-2">
            {p.purchase_number} <StatusBadge status={p.status} />
          </span>
        }
        description={`${p.supplier_name} · ${formatDate(p.purchase_date)} · supplier bill ${p.supplier_invoice_number ?? "—"}`}
        actions={
          <>
            {posted && Number(p.balance_due) > 0 && can(user.role, "payments.supplier") ? (
              <Link href={`/payments/new?supplier=${p.supplier_id}`} className={buttonVariants()}>
                Record payment
              </Link>
            ) : null}
            {posted && Number(p.amount_paid) === 0 && can(user.role, "purchases.cancel") ? (
              <CancelButton
                id={id}
                action={cancelPurchase}
                label="Cancel purchase"
                title={`Cancel ${p.purchase_number}?`}
                description="The received quantities are removed from stock with compensating ledger entries. The purchase stays on record as cancelled."
              />
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader
            title="Items"
            description={
              <Badge tone={p.supply_type === "intra_state" ? "neutral" : "info"}>
                {p.supply_type === "intra_state" ? "Intra-state · CGST + SGST" : "Inter-state · IGST"}
              </Badge>
            }
          />
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Item</TH>
                <TH className="text-right">Qty</TH>
                <TH className="text-right">Rate</TH>
                <TH className="text-right">Discount</TH>
                <TH className="text-right">Taxable</TH>
                <TH className="text-right">GST</TH>
                <TH className="text-right">Total</TH>
              </TR>
            </THead>
            <TBody>
              {lines.map((l) => (
                <TR key={l.id}>
                  <TD className="text-muted-foreground">{l.line_no}</TD>
                  <TD>
                    <Link href={`/inventory/products/${l.product_id}`} className="font-medium hover:underline">
                      {l.product_name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      {l.sku} · HSN {l.hsn_code ?? "—"}
                    </p>
                  </TD>
                  <TDNum>{formatQty(l.quantity, l.uom)}</TDNum>
                  <TDNum>{formatINR(l.unit_price)}</TDNum>
                  <TDNum>{formatINR(l.discount_amount)}</TDNum>
                  <TDNum>{formatINR(l.taxable_value)}</TDNum>
                  <TDNum className="text-muted-foreground">
                    {l.gst_rate}%<br />
                    <span className="text-xs">{formatINR(dec(l.cgst_amount).plus(l.sgst_amount).plus(l.igst_amount))}</span>
                  </TDNum>
                  <TDNum className="font-medium">{formatINR(l.line_total)}</TDNum>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        <div className="space-y-4">
          <TaxSummary
            supplyType={p.supply_type ?? "intra_state"}
            totals={{
              subtotal: dec(p.subtotal),
              discount: lines.reduce((s, l) => s.plus(dec(l.discount_amount)), dec(0)),
              cgst: dec(p.cgst_total),
              sgst: dec(p.sgst_total),
              igst: dec(p.igst_total),
              tax: dec(p.tax_total),
              roundOff: dec(0),
              grandTotal: dec(p.grand_total),
            }}
          />
          <Card>
            <CardHeader title="Payments" description={`Paid ${formatINR(p.amount_paid)} · balance ${formatINR(p.balance_due)}`} />
            <CardContent className="space-y-2 text-sm">
              {payments.length === 0 ? (
                <p className="text-muted-foreground">No payments recorded.</p>
              ) : (
                payments.map((pm) => (
                  <div key={pm.id} className="flex justify-between gap-2">
                    <span>
                      {pm.payment_number}
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(pm.payment_date)} · {PAYMENT_METHOD_LABELS[pm.method ?? ""] ?? pm.method}
                        {pm.reference ? ` · ${pm.reference}` : ""}
                      </span>
                    </span>
                    <span className="tabular">{formatINR(pm.amount)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          {p.notes ? (
            <Card>
              <CardContent className="text-sm whitespace-pre-line text-muted-foreground">{p.notes}</CardContent>
            </Card>
          ) : null}
          <p className="text-xs text-muted-foreground">Recorded {formatDateTime(p.created_at)}</p>
        </div>
      </div>
    </>
  )
}
