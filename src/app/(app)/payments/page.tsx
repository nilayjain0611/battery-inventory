import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { PlusIcon, WalletIcon } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { FilterBar, FilterField } from "@/components/common/filter-bar"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input, Select } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { listPayments } from "@/lib/data/payments"
import { dec, formatINR } from "@/lib/domain/money"
import { can, canRecordReceipts } from "@/lib/domain/permissions"
import { PAYMENT_METHOD_LABELS, formatDate, param, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Payments" }

export default function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Payments"
        description="Customer receipts and supplier payments, each allocated to specific invoices or purchases."
        actions={
          <Suspense fallback={null}>
            <NewButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Card><TableSkeleton /></Card>}>
        <Payments searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function NewButton() {
  const user = await getCurrentUser()
  if (!canRecordReceipts(user.role, user.canRecordReceipts) && !can(user.role, "payments.supplier")) return null
  return (
    <Link href="/payments/new" className={buttonVariants()}>
      <PlusIcon /> Record payment
    </Link>
  )
}

async function Payments({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const direction = param(sp.direction)
  const method = param(sp.method)
  const from = param(sp.from)
  const to = param(sp.to)
  const rows = await listPayments({ direction, method: method && method in PAYMENT_METHOD_LABELS ? method : undefined, from, to })
  const received = rows.filter((r) => r.direction === "receipt").reduce((s, r) => s.plus(dec(r.amount)), dec(0))
  const paid = rows.filter((r) => r.direction === "payment").reduce((s, r) => s.plus(dec(r.amount)), dec(0))

  return (
    <>
      <FilterBar action="/payments" resetHref="/payments">
        <FilterField label="Type">
          <Select name="direction" defaultValue={direction ?? ""}>
            <option value="">All</option>
            <option value="receipt">Receipts</option>
            <option value="payment">Supplier payments</option>
          </Select>
        </FilterField>
        <FilterField label="Method">
          <Select name="method" defaultValue={method ?? ""}>
            <option value="">All</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
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
          <EmptyState icon={WalletIcon} title="No payments found" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Payment</TH>
                <TH>Type</TH>
                <TH>Party</TH>
                <TH>Method</TH>
                <TH>Allocated to</TH>
                <TH className="text-right">Amount</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <span className="font-medium">{r.payment_number}</span>
                    <p className="text-xs text-muted-foreground">{formatDate(r.payment_date)}</p>
                  </TD>
                  <TD>
                    <Badge tone={r.direction === "receipt" ? "success" : "warning"}>{r.direction === "receipt" ? "Receipt" : "Paid out"}</Badge>
                  </TD>
                  <TD>{r.party_name}</TD>
                  <TD className="text-sm">
                    {PAYMENT_METHOD_LABELS[r.method ?? ""] ?? r.method}
                    {r.reference ? <p className="font-mono text-[11px] text-muted-foreground">{r.reference}</p> : null}
                  </TD>
                  <TD className="max-w-64 font-mono text-xs">{r.allocated_to ?? "—"}</TD>
                  <TDNum className={r.direction === "receipt" ? "font-medium text-success" : "font-medium"}>
                    {r.direction === "receipt" ? "+" : "−"}
                    {formatINR(r.amount)}
                  </TDNum>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        Received {formatINR(received)} · paid out {formatINR(paid)}
      </p>
    </>
  )
}
