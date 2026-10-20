import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { PlusIcon, TruckIcon } from "lucide-react"

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
import { listSuppliers } from "@/lib/data/parties"
import { listPurchases } from "@/lib/data/purchases"
import { dec, formatINR } from "@/lib/domain/money"
import { can } from "@/lib/domain/permissions"
import { id as idSchema } from "@/lib/domain/schemas"
import { formatDate, param, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Purchases" }

export default function PurchasesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Purchases"
        description="Supplier bills with goods received. Each confirmed purchase adds stock through the ledger exactly once."
        actions={
          <Suspense fallback={null}>
            <NewButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Card><TableSkeleton /></Card>}>
        <PurchasesTable searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function NewButton() {
  const user = await getCurrentUser()
  if (!can(user.role, "purchases.create")) return null
  return (
    <Link href="/purchases/new" className={buttonVariants()}>
      <PlusIcon /> Record purchase
    </Link>
  )
}

async function PurchasesTable({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const supplier = param(sp.supplier)
  const supplierId = supplier && idSchema.safeParse(supplier).success ? supplier : undefined
  const from = param(sp.from)
  const to = param(sp.to)
  const status = param(sp.status)
  const [rows, suppliers] = await Promise.all([listPurchases({ supplierId, from, to, status }), listSuppliers({ includeInactive: true })])
  const total = rows.filter((r) => r.status === "posted").reduce((s, r) => s.plus(dec(r.grand_total)), dec(0))

  return (
    <>
      <FilterBar action="/purchases" resetHref="/purchases">
        <FilterField label="Supplier">
          <Select name="supplier" defaultValue={supplierId ?? ""} className="w-56">
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id ?? ""}>
                {s.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">All</option>
            <option value="unpaid">Payable</option>
            <option value="posted">Posted</option>
            <option value="cancelled">Cancelled</option>
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
          <EmptyState icon={TruckIcon} title="No purchases found" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Purchase</TH>
                <TH>Supplier</TH>
                <TH>Supplier bill</TH>
                <TH className="text-right">Taxable</TH>
                <TH className="text-right">GST</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Balance</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/purchases/${r.id}`} className="font-medium text-primary hover:underline">
                      {r.purchase_number}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatDate(r.purchase_date)}</p>
                  </TD>
                  <TD>{r.supplier_name}</TD>
                  <TD className="font-mono text-xs">{r.supplier_invoice_number ?? "—"}</TD>
                  <TDNum>{formatINR(r.subtotal)}</TDNum>
                  <TDNum className="text-muted-foreground">{formatINR(r.tax_total)}</TDNum>
                  <TDNum className="font-medium">{formatINR(r.grand_total)}</TDNum>
                  <TDNum className={Number(r.balance_due) > 0 ? "font-semibold" : "text-muted-foreground"}>{formatINR(r.balance_due)}</TDNum>
                  <TD>
                    {r.status === "cancelled" ? (
                      <StatusBadge status="cancelled" />
                    ) : Number(r.balance_due) > 0 ? (
                      <Badge tone="warning">{Number(r.amount_paid) > 0 ? "Part-paid" : "Payable"}</Badge>
                    ) : (
                      <StatusBadge status="paid" />
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        {rows.length} purchases · posted total {formatINR(total)}
      </p>
    </>
  )
}
