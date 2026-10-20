import type { Metadata } from "next"
import { Suspense } from "react"

import { NotAllowed } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { PurchaseForm } from "@/components/purchases/purchase-form"
import { PageSkeleton } from "@/components/ui/skeleton"
import { getUserWith } from "@/lib/auth"
import { getProductOptions } from "@/lib/data/inventory"
import { listSuppliers } from "@/lib/data/parties"
import { getCompany, getCurrentRates } from "@/lib/data/reference"
import { id as idSchema } from "@/lib/domain/schemas"
import { param, todayIST, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "Record purchase" }

export default function NewPurchasePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="max-w-6xl">
      <PageHeader title="Record purchase" back={{ href: "/purchases", label: "Purchases" }} />
      <Suspense fallback={<PageSkeleton />}>
        <NewPurchase searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function NewPurchase({ searchParams }: { searchParams: SearchParams }) {
  const { allowed } = await getUserWith("purchases.create")
  if (!allowed) return <NotAllowed what="record purchases" />
  const sp = await searchParams
  const supplier = param(sp.supplier)
  const today = todayIST()
  const [suppliers, products, company, rates] = await Promise.all([
    listSuppliers(),
    getProductOptions(["raw_material", "trading", "manufactured"]),
    getCompany(),
    getCurrentRates(today),
  ])
  const rateByCode = new Map(rates.map((r) => [r.code, r.rate]))

  return (
    <PurchaseForm
      today={today}
      companyState={company.state_code}
      defaultSupplierId={supplier && idSchema.safeParse(supplier).success ? supplier : undefined}
      suppliers={suppliers.map((s) => ({ id: s.id ?? "", name: s.name ?? "", state_code: s.state_code ?? "", gstin: s.gstin }))}
      products={products.map((p) => ({
        id: p.id ?? "",
        sku: p.sku ?? "",
        name: p.name ?? "",
        stock_type: p.stock_type ?? "trading",
        uom: p.uom ?? "",
        quantity: Number(p.quantity ?? 0),
        brand_name: p.brand_name,
        purchase_price: Number(p.purchase_price ?? 0),
        gst_rate: rateByCode.get(p.gst_rate_code ?? "") ?? 0,
        hsn_code: p.hsn_code,
      }))}
    />
  )
}
