import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { DownloadIcon, PencilIcon, PrinterIcon, WalletIcon } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { CancelButton } from "@/components/documents/cancel-button"
import { InvoiceView } from "@/components/sales/invoice-view"
import { PostInvoiceButton } from "@/components/sales/post-invoice-button"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PageSkeleton } from "@/components/ui/skeleton"
import { cancelInvoice } from "@/lib/actions/sales"
import { getCurrentUser } from "@/lib/auth"
import { getInvoice } from "@/lib/data/sales"
import { buildInvoiceModel } from "@/lib/domain/invoice-model"
import { formatINR } from "@/lib/domain/money"
import { can, canRecordReceipts } from "@/lib/domain/permissions"
import { id as idSchema } from "@/lib/domain/schemas"
import { PAYMENT_METHOD_LABELS, formatDate, formatDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Invoice" }

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvoiceDetail params={params} />
    </Suspense>
  )
}

async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!idSchema.safeParse(id).success) notFound()
  const [user, detail] = await Promise.all([getCurrentUser(), getInvoice(id)])
  if (!detail) notFound()
  const m = buildInvoiceModel(detail)
  const inv = detail.invoice
  const isDraft = inv.status === "draft"
  const isPosted = inv.status === "posted"
  const balance = m.balanceDue

  const canCancel =
    (isDraft && can(user.role, "sales.create")) || (isPosted && Number(inv.amount_paid) === 0 && can(user.role, "sales.cancelPosted"))

  return (
    <>
      <PageHeader
        back={{ href: "/sales", label: "Sales" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {inv.invoice_number ?? "Draft invoice"} <StatusBadge status={isPosted ? (balance.lte(0) ? "paid" : "posted") : inv.status} />
          </span>
        }
        description={`${inv.customer_name} · ${formatDate(inv.invoice_date)} · ${inv.sale_type === "wholesale" ? "Wholesale" : "Retail"}`}
        actions={
          <>
            <a href={`/sales/${id}/pdf`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline" })}>
              <PrinterIcon /> Print
            </a>
            <a href={`/sales/${id}/pdf?download=1`} className={buttonVariants({ variant: "outline" })}>
              <DownloadIcon /> PDF
            </a>
            {isDraft && can(user.role, "sales.create") ? (
              <>
                <Link href={`/sales/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
                  <PencilIcon /> Edit
                </Link>
                <PostInvoiceButton id={id} total={formatINR(inv.grand_total)} />
              </>
            ) : null}
            {isPosted && balance.gt(0) && canRecordReceipts(user.role, user.canRecordReceipts) ? (
              <Link href={`/payments/new?invoice=${id}`} className={buttonVariants()}>
                <WalletIcon /> Record payment
              </Link>
            ) : null}
            {canCancel ? (
              <CancelButton
                id={id}
                action={cancelInvoice}
                label={isDraft ? "Discard draft" : "Cancel invoice"}
                title={isDraft ? "Discard this draft?" : `Cancel ${inv.invoice_number}?`}
                description={
                  isDraft
                    ? "The draft is marked cancelled. No stock or number was used."
                    : "Items are returned to stock with compensating ledger entries. The invoice number stays on record as cancelled."
                }
              />
            ) : null}
          </>
        }
      />

      {isDraft ? (
        <div className="mb-4 rounded-md border border-primary/20 bg-accent px-4 py-2.5 text-sm text-accent-foreground">
          This is a draft. Figures are a preview; posting recalculates them, allocates the number and updates stock.
        </div>
      ) : null}
      {inv.status === "cancelled" ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          Cancelled {formatDateTime(inv.cancelled_at)}{inv.cancel_reason ? `: ${inv.cancel_reason}` : ""}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <InvoiceView m={m} />
        <div className="space-y-4">
          <Card>
            <CardHeader title="Payments" description={isPosted ? `Received ${formatINR(inv.amount_paid)} of ${formatINR(inv.grand_total)}` : undefined} />
            <CardContent className="space-y-3 text-sm">
              {detail.payments.length === 0 ? (
                <p className="text-muted-foreground">{isPosted ? "No payments recorded yet." : "Payments can be recorded once the invoice is posted."}</p>
              ) : (
                detail.payments.map((p) => (
                  <div key={p.id} className="flex justify-between gap-2">
                    <span>
                      <span className="font-medium">{p.payment_number}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(p.payment_date)} · {PAYMENT_METHOD_LABELS[p.method ?? ""] ?? p.method}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </span>
                    </span>
                    <span className="tabular">{formatINR(p.allocated)}</span>
                  </div>
                ))
              )}
              {isPosted ? (
                <div className="flex justify-between border-t pt-2 font-medium">
                  <span>Balance due</span>
                  <span className={`tabular ${balance.gt(0) ? "text-destructive" : "text-success"}`}>{formatINR(balance)}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Record" />
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>Created {formatDateTime(inv.created_at)}</p>
              {inv.posted_at ? (
                <p>
                  Posted {formatDateTime(inv.posted_at)}
                  {detail.postedByName ? ` by ${detail.postedByName}` : ""}
                </p>
              ) : null}
              <p>Prices entered {inv.prices_include_tax ? "including" : "excluding"} GST</p>
              {isPosted ? (
                <Link href={`/inventory/movements?type=sale`} className="text-primary hover:underline">
                  See stock movements
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
