import type { Metadata } from "next"
import { Suspense } from "react"

import { NotAllowed } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { InvoiceBuilder } from "@/components/sales/invoice-builder"
import { PageSkeleton } from "@/components/ui/skeleton"
import { getUserWith } from "@/lib/auth"
import { getInvoiceBuilderData } from "@/lib/data/invoice-builder"
import { id as idSchema } from "@/lib/domain/schemas"
import { addDays, param, todayIST, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "New invoice" }

export default function NewInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="max-w-7xl">
      <PageHeader title="New invoice" back={{ href: "/sales", label: "Sales" }} />
      <Suspense fallback={<PageSkeleton />}>
        <NewInvoice searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function NewInvoice({ searchParams }: { searchParams: SearchParams }) {
  const { allowed } = await getUserWith("sales.create")
  if (!allowed) return <NotAllowed what="create invoices" />
  const sp = await searchParams
  const today = todayIST()
  const data = await getInvoiceBuilderData(today)
  const requested = param(sp.customer)
  const customer =
    data.customers.find((c) => requested && idSchema.safeParse(requested).success && c.id === requested) ??
    data.customers.find((c) => c.is_walk_in)

  return (
    <InvoiceBuilder
      today={today}
      companyState={data.company.state_code}
      states={data.states}
      customers={data.customers}
      products={data.products}
      initial={{
        customer_id: customer?.id ?? "",
        sale_type: customer?.is_walk_in ? "retail" : (customer?.customer_type ?? "retail"),
        invoice_date: today,
        due_date: customer?.credit_days ? addDays(today, customer.credit_days) : "",
        place_of_supply: customer?.is_walk_in ? data.company.state_code : (customer?.state_code ?? data.company.state_code),
        prices_include_tax: customer?.is_walk_in || customer?.customer_type !== "wholesale",
        payment_terms: customer?.credit_days ? `Net ${customer.credit_days} days` : "Due on receipt",
        billing_address: customer?.billing_address ?? "",
        shipping_address: customer?.shipping_address ?? "",
        notes: "",
        lines: [],
      }}
    />
  )
}
