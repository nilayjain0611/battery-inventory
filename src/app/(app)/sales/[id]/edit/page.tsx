import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { NotAllowed } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { InvoiceBuilder } from "@/components/sales/invoice-builder"
import { PageSkeleton } from "@/components/ui/skeleton"
import { getUserWith } from "@/lib/auth"
import { getInvoiceBuilderData } from "@/lib/data/invoice-builder"
import { getInvoice } from "@/lib/data/sales"
import { id as idSchema } from "@/lib/domain/schemas"
import { todayIST } from "@/lib/format"

export const metadata: Metadata = { title: "Edit draft invoice" }

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="max-w-7xl">
      <Suspense fallback={<PageSkeleton />}>
        <EditInvoice params={params} />
      </Suspense>
    </div>
  )
}

async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!idSchema.safeParse(id).success) notFound()
  const { allowed } = await getUserWith("sales.create")
  const detail = await getInvoice(id)
  if (!detail) notFound()
  if (detail.invoice.status !== "draft") redirect(`/sales/${id}`)
  if (!allowed) return <NotAllowed what="edit invoices" />
  const inv = detail.invoice
  const data = await getInvoiceBuilderData(inv.invoice_date)

  return (
    <>
      <PageHeader title="Edit draft invoice" back={{ href: `/sales/${id}`, label: "Back to draft" }} />
      <InvoiceBuilder
        invoiceId={id}
        today={todayIST()}
        companyState={data.company.state_code}
        states={data.states}
        customers={data.customers}
        products={data.products}
        initial={{
          customer_id: inv.customer_id,
          sale_type: inv.sale_type,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date ?? "",
          place_of_supply: inv.place_of_supply,
          prices_include_tax: inv.prices_include_tax,
          payment_terms: inv.payment_terms ?? "",
          billing_address: inv.billing_address ?? "",
          shipping_address: inv.shipping_address ?? "",
          notes: inv.notes ?? "",
          lines: detail.lines.map((l) => ({
            product_id: l.product_id,
            quantity: String(l.quantity),
            unit_price: String(l.unit_price),
            discount_type: l.discount_type ?? "",
            discount_value: l.discount_value ? String(l.discount_value) : "",
          })),
        }}
      />
    </>
  )
}
