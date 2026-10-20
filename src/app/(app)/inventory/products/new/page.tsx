import type { Metadata } from "next"
import { Suspense } from "react"

import { NotAllowed } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { ProductForm } from "@/components/inventory/product-form"
import { PageSkeleton } from "@/components/ui/skeleton"
import { getUserWith } from "@/lib/auth"
import { getBrandsAndCategories, getCurrentRates } from "@/lib/data/reference"
import { todayIST } from "@/lib/format"

export const metadata: Metadata = { title: "New product" }

export default function NewProductPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader title="New product" back={{ href: "/inventory/products", label: "Products" }} />
      <Suspense fallback={<PageSkeleton />}>
        <NewProduct />
      </Suspense>
    </div>
  )
}

async function NewProduct() {
  const { allowed } = await getUserWith("products.manage")
  if (!allowed) return <NotAllowed what="create products" />
  const [{ brands, categories }, rates] = await Promise.all([getBrandsAndCategories(), getCurrentRates(todayIST())])
  return (
    <ProductForm
      brands={brands}
      categories={categories}
      rates={rates}
      initial={{
        sku: "",
        name: "",
        description: "",
        brand_id: "",
        category_id: "",
        stock_type: "trading",
        uom: "PCS",
        hsn_code: "8507",
        gst_rate_code: rates.find((r) => r.code === "GST18")?.code ?? "",
        purchase_price: "",
        retail_price: "",
        wholesale_price: "",
        reorder_level: "0",
        is_active: true,
      }}
    />
  )
}
