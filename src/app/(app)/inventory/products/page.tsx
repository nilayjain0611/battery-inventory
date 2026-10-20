import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { PackageIcon, PlusIcon } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { FilterBar, FilterField } from "@/components/common/filter-bar"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge, StockTypeBadge } from "@/components/common/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input, Select } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeleton"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import { listProducts } from "@/lib/data/inventory"
import { formatINR, formatQty } from "@/lib/domain/money"
import { can } from "@/lib/domain/permissions"
import { param, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Products" }

export default function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Products"
        description="Raw materials, own-brand batteries and third-party batteries in one catalogue."
        actions={
          <Suspense fallback={null}>
            <NewButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Card><TableSkeleton /></Card>}>
        <ProductsTable searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function NewButton() {
  const user = await getCurrentUser()
  if (!can(user.role, "products.manage")) return null
  return (
    <Link href="/inventory/products/new" className={buttonVariants()}>
      <PlusIcon /> New product
    </Link>
  )
}

async function ProductsTable({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const q = param(sp.q)
  const type = param(sp.type)
  const filter = param(sp.filter)
  const products = await listProducts({ q, type, filter })

  return (
    <>
      <FilterBar action="/inventory/products" resetHref="/inventory/products">
        <FilterField label="Search">
          <Input name="q" defaultValue={q} placeholder="Name, SKU, HSN…" className="w-64" />
        </FilterField>
        <FilterField label="Stock type">
          <Select name="type" defaultValue={type ?? ""}>
            <option value="">All types</option>
            <option value="raw_material">Raw materials</option>
            <option value="manufactured">Own brand</option>
            <option value="trading">Third-party</option>
          </Select>
        </FilterField>
        <FilterField label="Show">
          <Select name="filter" defaultValue={filter ?? ""}>
            <option value="">Active</option>
            <option value="low">Low stock</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </Select>
        </FilterField>
      </FilterBar>

      <Card>
        {products.length === 0 ? (
          <EmptyState
            icon={PackageIcon}
            title={q || type || filter ? "No products match these filters" : "No products yet"}
            description={q ? `Nothing found for “${q}”.` : "Create your first product to start tracking stock."}
            action={
              <Link href="/inventory/products/new" className={buttonVariants({ variant: "outline" })}>
                New product
              </Link>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Product</TH>
                <TH>Type</TH>
                <TH>HSN · GST</TH>
                <TH className="text-right">On hand</TH>
                <TH className="text-right">Value</TH>
                <TH className="text-right">Retail (incl.)</TH>
                <TH className="text-right">Wholesale (excl.)</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {products.map((p) => (
                <TR key={p.id}>
                  <TD className="font-mono text-xs">{p.sku}</TD>
                  <TD>
                    <Link href={`/inventory/products/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[p.brand_name, p.category_name].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </TD>
                  <TD>
                    <StockTypeBadge type={p.stock_type} />
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {p.hsn_code ?? "—"} · {p.gst_rate_code}
                  </TD>
                  <TDNum className={p.is_low_stock ? "font-semibold text-destructive" : ""}>{formatQty(p.quantity, p.uom)}</TDNum>
                  <TDNum>{formatINR(p.stock_value)}</TDNum>
                  <TDNum>{p.stock_type === "raw_material" ? "—" : formatINR(p.retail_price)}</TDNum>
                  <TDNum>{p.stock_type === "raw_material" ? "—" : formatINR(p.wholesale_price)}</TDNum>
                  <TD>
                    {p.is_low_stock ? <StatusBadge status="low" /> : null}
                    {!p.is_active ? <StatusBadge status="inactive" /> : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">{products.length} products</p>
    </>
  )
}
