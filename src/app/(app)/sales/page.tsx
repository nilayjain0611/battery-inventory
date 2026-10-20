import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { PlusIcon, ReceiptIndianRupeeIcon } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { FilterBar, FilterField } from "@/components/common/filter-bar"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input, Select } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { listCustomers } from "@/lib/data/parties"
import { listInvoices } from "@/lib/data/sales"
import { dec, formatINR } from "@/lib/domain/money"
import { can } from "@/lib/domain/permissions"
import { id as idSchema } from "@/lib/domain/schemas"
import { formatDate, param, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Sales & invoices" }

export default function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Sales & invoices"
        description="Retail and wholesale GST invoices. Posted invoices are immutable; corrections are made by cancellation."
        actions={
          <Suspense fallback={null}>
            <NewButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Card><TableSkeleton rows={8} /></Card>}>
        <Invoices searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function NewButton() {
  const user = await getCurrentUser()
  if (!can(user.role, "sales.create")) return null
  return (
    <Link href="/sales/new" className={buttonVariants()}>
      <PlusIcon /> New invoice
    </Link>
  )
}

async function Invoices({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const customer = param(sp.customer)
  const customerId = customer && idSchema.safeParse(customer).success ? customer : undefined
  const status = param(sp.status)
  const saleType = param(sp.type)
  const from = param(sp.from)
  const to = param(sp.to)
  const q = param(sp.q)
  const [rows, customers] = await Promise.all([
    listInvoices({ customerId, status, from, to, q, saleType }),
    listCustomers({ includeInactive: true }),
  ])
  const posted = rows.filter((r) => r.status === "posted")
  const total = posted.reduce((s, r) => s.plus(dec(r.grand_total)), dec(0))
  const due = posted.reduce((s, r) => s.plus(dec(r.balance_due)), dec(0))

  return (
    <>
      <FilterBar action="/sales" resetHref="/sales">
        <FilterField label="Invoice no.">
          <Input name="q" defaultValue={q} placeholder="INV/2026-27/…" className="w-40" />
        </FilterField>
        <FilterField label="Customer">
          <Select name="customer" defaultValue={customerId ?? ""} className="w-52">
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id ?? ""}>
                {c.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">All</option>
            <option value="outstanding">Outstanding</option>
            <option value="overdue">Overdue</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Part-paid</option>
            <option value="paid">Paid</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </FilterField>
        <FilterField label="Type">
          <Select name="type" defaultValue={saleType ?? ""}>
            <option value="">All</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
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
          <EmptyState
            icon={ReceiptIndianRupeeIcon}
            title="No invoices match"
            action={
              <Link href="/sales/new" className={buttonVariants({ variant: "outline" })}>
                Create invoice
              </Link>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Invoice</TH>
                <TH>Customer</TH>
                <TH>Type</TH>
                <TH className="text-right">Taxable</TH>
                <TH className="text-right">GST</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Balance</TH>
                <TH>Due</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/sales/${r.id}`} className="font-medium text-primary hover:underline">
                      {r.invoice_number ?? "Draft"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatDate(r.invoice_date)}</p>
                  </TD>
                  <TD>
                    <span className="block max-w-56 truncate">{r.customer_name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{r.customer_gstin ?? "B2C"}</span>
                  </TD>
                  <TD>
                    <Badge tone={r.sale_type === "wholesale" ? "info" : "neutral"}>{r.sale_type === "wholesale" ? "Wholesale" : "Retail"}</Badge>
                  </TD>
                  <TDNum>{formatINR(r.subtotal)}</TDNum>
                  <TDNum className="text-muted-foreground">{formatINR(r.tax_total)}</TDNum>
                  <TDNum className="font-medium">{formatINR(r.grand_total)}</TDNum>
                  <TDNum className={Number(r.balance_due) > 0 ? "font-semibold" : "text-muted-foreground"}>{formatINR(r.balance_due)}</TDNum>
                  <TD className="text-xs text-muted-foreground">{formatDate(r.due_date)}</TD>
                  <TD>
                    <StatusBadge status={r.payment_status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        {rows.length} invoices · posted total {formatINR(total)} · outstanding {formatINR(due)}
      </p>
    </>
  )
}
