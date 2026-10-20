import type { Metadata } from "next"
import { Suspense } from "react"

import { NotAllowed } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { PaymentForm } from "@/components/payments/payment-form"
import { PageSkeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"
import { listCustomers, listSuppliers } from "@/lib/data/parties"
import { getOpenDocuments } from "@/lib/data/payments"
import { can, canRecordReceipts } from "@/lib/domain/permissions"
import { param, todayIST, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Record payment" }

export default function NewPaymentPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="max-w-5xl">
      <PageHeader title="Record payment" back={{ href: "/payments", label: "Payments" }} />
      <Suspense fallback={<PageSkeleton />}>
        <NewPayment searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function NewPayment({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()
  const canReceive = canRecordReceipts(user.role, user.canRecordReceipts)
  const canPay = can(user.role, "payments.supplier")
  if (!canReceive && !canPay) return <NotAllowed what="record payments" />

  const sp = await searchParams
  const [customers, suppliers, open] = await Promise.all([listCustomers(), listSuppliers(), getOpenDocuments()])
  const invoices = open.invoices.map((i) => ({
    id: i.id ?? "",
    number: i.invoice_number ?? "",
    partyId: i.customer_id ?? "",
    date: i.invoice_date ?? "",
    due: i.due_date,
    total: Number(i.grand_total ?? 0),
    balance: Number(i.balance_due ?? 0),
  }))
  const purchases = open.purchases.map((p) => ({
    id: p.id ?? "",
    number: p.purchase_number ?? "",
    partyId: p.supplier_id ?? "",
    date: p.purchase_date ?? "",
    due: null,
    total: Number(p.grand_total ?? 0),
    balance: Number(p.balance_due ?? 0),
    extra: p.supplier_invoice_number ? `bill ${p.supplier_invoice_number}` : null,
  }))

  // Pre-select from ?invoice=, ?customer= or ?supplier=
  const invoiceParam = param(sp.invoice)
  const fromInvoice = invoices.find((i) => i.id === invoiceParam)
  const supplierParam = param(sp.supplier)
  const customerParam = param(sp.customer)
  const direction: "receipt" | "payment" = (supplierParam && canPay) || !canReceive ? "payment" : "receipt"
  const partyId =
    direction === "payment"
      ? (suppliers.find((s) => s.id === supplierParam)?.id ?? "")
      : (fromInvoice?.partyId ?? customers.find((c) => c.id === customerParam)?.id ?? "")

  return (
    <PaymentForm
      today={todayIST()}
      canReceive={canReceive}
      canPay={canPay}
      customers={customers.map((c) => ({ id: c.id ?? "", name: c.name ?? "" }))}
      suppliers={suppliers.map((s) => ({ id: s.id ?? "", name: s.name ?? "" }))}
      invoices={invoices}
      purchases={purchases}
      initial={{
        direction,
        partyId,
        allocations: fromInvoice ? { [fromInvoice.id]: String(fromInvoice.balance) } : {},
      }}
    />
  )
}
