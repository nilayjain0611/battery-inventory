import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ContactIcon } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { FilterBar, FilterField } from "@/components/common/filter-bar"
import { PageHeader } from "@/components/common/page-header"
import { PartyDialog, emptyParty } from "@/components/parties/party-dialog"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { listSuppliers } from "@/lib/data/parties"
import { getCompany, getStates } from "@/lib/data/reference"
import { dec, formatINR } from "@/lib/domain/money"
import { can } from "@/lib/domain/permissions"
import { formatDate, param, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Suppliers" }

export default function SuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <Suspense fallback={<PageHeader title="Suppliers" />}>
        <Header />
      </Suspense>
      <Suspense fallback={<Card><TableSkeleton /></Card>}>
        <SuppliersTable searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Header() {
  const [user, states, company] = await Promise.all([getCurrentUser(), getStates(), getCompany()])
  return (
    <PageHeader
      title="Suppliers"
      description="Raw-material vendors and third-party battery distributors, with amounts owed on credit purchases."
      actions={
        can(user.role, "suppliers.manage") ? (
          <PartyDialog kind="supplier" initial={emptyParty(company.state_code)} states={states} />
        ) : null
      }
    />
  )
}

async function SuppliersTable({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const q = param(sp.q)
  const [user, suppliers, states] = await Promise.all([getCurrentUser(), listSuppliers({ q }), getStates()])
  const canEdit = can(user.role, "suppliers.manage")
  const canPay = can(user.role, "payments.supplier")
  const stateName = new Map(states.map((s) => [s.code, s.name]))
  const totalOwed = suppliers.reduce((s, c) => s.plus(dec(c.outstanding)), dec(0))

  return (
    <>
      <FilterBar action="/suppliers" resetHref="/suppliers">
        <FilterField label="Search">
          <Input name="q" defaultValue={q} placeholder="Supplier name" className="w-56" />
        </FilterField>
      </FilterBar>
      <Card>
        {suppliers.length === 0 ? (
          <EmptyState icon={ContactIcon} title="No suppliers found" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Supplier</TH>
                <TH>GSTIN · State</TH>
                <TH className="text-right">Purchased</TH>
                <TH className="text-right">Paid</TH>
                <TH className="text-right">Payable</TH>
                <TH>Last purchase</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {suppliers.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/purchases?supplier=${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{[s.contact_person, s.phone].filter(Boolean).join(" · ") || "—"}</p>
                  </TD>
                  <TD className="text-xs">
                    <span className="font-mono">{s.gstin ?? "Unregistered"}</span>
                    <p className="text-muted-foreground">
                      {stateName.get(s.state_code ?? "") ?? s.state_code}
                      {!s.is_active ? <Badge className="ml-1">Inactive</Badge> : null}
                    </p>
                  </TD>
                  <TDNum>{formatINR(s.total_purchased)}</TDNum>
                  <TDNum>{formatINR(s.total_paid)}</TDNum>
                  <TDNum className={Number(s.outstanding) > 0 ? "font-semibold" : "text-muted-foreground"}>
                    {formatINR(s.outstanding)}
                  </TDNum>
                  <TD className="text-xs text-muted-foreground">{formatDate(s.last_purchase_date)}</TD>
                  <TD className="text-right whitespace-nowrap">
                    {canPay && Number(s.outstanding) > 0 ? (
                      <Link href={`/payments/new?supplier=${s.id}`} className="mr-2 text-xs text-primary hover:underline">
                        Pay
                      </Link>
                    ) : null}
                    {canEdit ? (
                      <PartyDialog
                        kind="supplier"
                        id={s.id ?? undefined}
                        states={states}
                        initial={{
                          ...emptyParty(s.state_code ?? ""),
                          name: s.name ?? "",
                          contact_person: s.contact_person ?? "",
                          gstin: s.gstin ?? "",
                          phone: s.phone ?? "",
                          email: s.email ?? "",
                          billing_address: s.address ?? "",
                          is_active: s.is_active ?? true,
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
        {suppliers.length} suppliers · total payable {formatINR(totalOwed)}
      </p>
    </>
  )
}
