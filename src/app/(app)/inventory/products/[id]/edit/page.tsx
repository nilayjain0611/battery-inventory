import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { NotAllowed } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { ProductForm } from "@/components/inventory/product-form"
import { PageSkeleton } from "@/components/ui/skeleton"
import { getUserWith } from "@/lib/auth"
import { getProduct } from "@/lib/data/inventory"
import { getBrandsAndCategories, getCurrentRates } from "@/lib/data/reference"
import { id as idSchema } from "@/lib/domain/schemas"
import { createClient } from "@/lib/supabase/server"
import { todayIST } from "@/lib/format"

export const metadata: Metadata = { title: "Edit product" }

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="max-w-5xl">
      <Suspense fallback={<PageSkeleton />}>
        <EditProduct params={params} />
      </Suspense>
    </div>
  )
}

async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!idSchema.safeParse(id).success) notFound()
  const { allowed } = await getUserWith("products.manage")
  const product = await getProduct(id)
  if (!product) notFound()
  if (!allowed) return <NotAllowed what="edit products" />

  const supabase = await createClient()
  const [{ brands, categories }, rates, movementCount] = await Promise.all([
    getBrandsAndCategories(),
    getCurrentRates(todayIST()),
    supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("product_id", id),
  ])
  const str = (v: number | null) => (v === null ? "" : String(v))

  return (
    <>
      <PageHeader title={`Edit ${product.sku}`} back={{ href: `/inventory/products/${id}`, label: product.name ?? "Product" }} />
      <ProductForm
        productId={id}
        brands={brands}
        categories={categories}
        rates={rates}
        stockTypeLocked={(movementCount.count ?? 0) > 0}
        initial={{
          sku: product.sku ?? "",
          name: product.name ?? "",
          description: product.description ?? "",
          brand_id: product.brand_id ?? "",
          category_id: product.category_id ?? "",
          stock_type: product.stock_type ?? "trading",
          uom: product.uom ?? "PCS",
          hsn_code: product.hsn_code ?? "",
          gst_rate_code: product.gst_rate_code ?? "",
          purchase_price: str(product.purchase_price),
          retail_price: str(product.retail_price),
          wholesale_price: str(product.wholesale_price),
          reorder_level: str(product.reorder_level),
          is_active: product.is_active ?? true,
        }}
      />
    </>
  )
}
