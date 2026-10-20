import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { UsersIcon } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { FilterBar, FilterField } from "@/components/common/filter-bar"
import { PageHeader } from "@/components/common/page-header"
import { PartyDialog, emptyParty } from "@/components/parties/party-dialog"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input, Select } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { listCustomers } from "@/lib/data/parties"
import { getCompany, getStates } from "@/lib/data/reference"
import { dec, formatINR } from "@/lib/domain/money"
import { can, canRecordReceipts } from "@/lib/domain/permissions"
import { formatDate, param, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Customers" }

export default function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <Suspense fallback={<PageHeader title="Customers" />}>
        <Header />
      </Suspense>
      <Suspense fallback={<Card><TableSkeleton /></Card>}>
        <CustomersTable searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Header() {
  const [user, states, company] = await Promise.all([getCurrentUser(), getStates(), getCompany()])
  return (
    <PageHeader
      title="Customers"
      description="Retail and wholesale customers with live outstanding balances from posted invoices."
      actions={
        can(user.role, "customers.manage") ? (
          <PartyDialog kind="customer" initial={emptyParty(company.state_code)} states={states} />
        ) : null
      }
    />
  )
}

async function CustomersTable({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const q = param(sp.q)
  const type = param(sp.type)
  const [user, customers, states] = await Promise.all([
    getCurrentUser(),
    listCustomers({ q, type, includeInactive: param(sp.inactive) === "1" }),
    getStates(),
  ])
  const canEdit = can(user.role, "customers.manage")
  const canReceive = canRecordReceipts(user.role, user.canRecordReceipts)
  const stateName = new Map(states.map((s) => [s.code, s.name]))
  const totalOutstanding = customers.reduce((s, c) => s.plus(dec(c.outstanding)), dec(0))

  return (
    <>
      <FilterBar action="/customers" resetHref="/customers">
        <FilterField label="Search">
          <Input name="q" defaultValue={q} placeholder="Customer name" className="w-56" />
        </FilterField>
        <FilterField label="Type">
          <Select name="type" defaultValue={type ?? ""}>
            <option value="">All</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select name="inactive" defaultValue={param(sp.inactive) ?? ""}>
            <option value="">Active only</option>
            <option value="1">Include inactive</option>
          </Select>
        </FilterField>
      </FilterBar>
      <Card>
        {customers.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No customers found" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Type</TH>
                <TH>GSTIN · State</TH>
                <TH className="text-right">Invoiced</TH>
                <TH className="text-right">Outstanding</TH>
                <TH className="text-right">Overdue</TH>
                <TH>Last invoice</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {customers.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/sales?customer=${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[c.contact_person, c.phone].filter(Boolean).join(" · ") || (c.is_walk_in ? "Counter sales" : "—")}
                    </p>
                  </TD>
                  <TD>
                    {c.is_walk_in ? (
                      <Badge>Walk-in</Badge>
                    ) : (
                      <Badge tone={c.customer_type === "wholesale" ? "info" : "neutral"}>
                        {c.customer_type === "wholesale" ? "Wholesale" : "Retail"}
                      </Badge>
                    )}
                    {!c.is_active ? <Badge className="ml-1">Inactive</Badge> : null}
                  </TD>
                  <TD className="text-xs">
                    <span className="font-mono">{c.gstin ?? "Unregistered"}</span>
                    <p className="text-muted-foreground">{stateName.get(c.state_code ?? "") ?? c.state_code}</p>
                  </TD>
                  <TDNum>{formatINR(c.total_invoiced)}</TDNum>
                  <TDNum className={Number(c.outstanding) > 0 ? "font-semibold" : "text-muted-foreground"}>
                    {formatINR(c.outstanding)}
                  </TDNum>
                  <TDNum className={Number(c.overdue) > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
                    {formatINR(c.overdue)}
                  </TDNum>
                  <TD className="text-xs text-muted-foreground">{formatDate(c.last_invoice_date)}</TD>
                  <TD className="text-right whitespace-nowrap">
                    {canReceive && Number(c.outstanding) > 0 ? (
                      <Link href={`/payments/new?customer=${c.id}`} className="mr-2 text-xs text-primary hover:underline">
                        Receive
                      </Link>
                    ) : null}
                    {canEdit ? (
                      <PartyDialog
                        kind="customer"
                        id={c.id ?? undefined}
                        states={states}
                        isWalkIn={c.is_walk_in ?? false}
                        initial={{
                          name: c.name ?? "",
                          customer_type: c.customer_type ?? "retail",
                          contact_person: c.contact_person ?? "",
                          gstin: c.gstin ?? "",
                          state_code: c.state_code ?? "",
                          phone: c.phone ?? "",
                          email: c.email ?? "",
                          billing_address: c.billing_address ?? "",
                          shipping_address: c.shipping_address ?? "",
                          credit_days: String(c.credit_days ?? 0),
                          is_active: c.is_active ?? true,
                        }}
                      />
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        {customers.length} customers · total outstanding {formatINR(totalOutstanding)}
      </p>
    </>
  )
}
