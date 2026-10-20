"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FormError } from "@/components/ui/field"
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { createProduct, updateProduct } from "@/lib/actions/inventory"
import type { ProductInput } from "@/lib/domain/schemas"
import { STOCK_TYPE_LABELS } from "@/lib/format"
import type { RateOption } from "@/lib/data/reference"

type Errors = Record<string, string[] | undefined>
const NEW = "__new__"

export interface ProductFormValues {
  sku: string
  name: string
  description: string
  brand_id: string
  category_id: string
  stock_type: "raw_material" | "manufactured" | "trading"
  uom: string
  hsn_code: string
  gst_rate_code: string
  purchase_price: string
  retail_price: string
  wholesale_price: string
  reorder_level: string
  is_active: boolean
}

export function ProductForm({
  productId,
  initial,
  brands,
  categories,
  rates,
  stockTypeLocked,
}: {
  productId?: string
  initial: ProductFormValues
  brands: { id: string; name: string; is_own_brand: boolean }[]
  categories: { id: string; name: string }[]
  rates: RateOption[]
  stockTypeLocked?: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [v, setV] = useState<ProductFormValues>(initial)
  const [newBrand, setNewBrand] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [opening, setOpening] = useState({ quantity: "", unit_cost: "" })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }))

  const isRaw = v.stock_type === "raw_material"

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    const product: ProductInput = {
      ...v,
      brand_id: v.brand_id === NEW ? "" : v.brand_id,
      category_id: v.category_id === NEW ? "" : v.category_id,
      retail_price: isRaw ? 0 : v.retail_price,
      wholesale_price: isRaw ? 0 : v.wholesale_price,
    }
    startTransition(async () => {
      const brand = v.brand_id === NEW ? newBrand : undefined
      const category = v.category_id === NEW ? newCategory : undefined
      const res = productId
        ? await updateProduct({ id: productId, product, newBrand: brand, newCategory: category })
        : await createProduct({
            product,
            newBrand: brand,
            newCategory: category,
            opening: opening.quantity ? { quantity: opening.quantity, unit_cost: opening.unit_cost || "0" } : null,
          })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        setFormError(res.error)
        toast.error("Could not save product", res.error)
        return
      }
      toast.success(res.message ?? "Saved")
      router.push(`/inventory/products/${res.data.id}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Card>
        <CardHeader title="Identity" description="How the product appears on documents and in search" />
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="SKU" htmlFor="sku" required error={errors.sku} hint="Unique code, e.g. VX-AUTO-65">
            <Input id="sku" value={v.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} aria-invalid={!!errors.sku} />
          </Field>
          <Field label="Name" htmlFor="name" required error={errors.name} className="lg:col-span-2">
            <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />
          </Field>
          <Field
            label="Stock type"
            htmlFor="stock_type"
            required
            error={errors.stock_type}
            hint={stockTypeLocked ? "Locked because this product has stock history" : "Own brand = manufactured here"}
          >
            <Select
              id="stock_type"
              value={v.stock_type}
              disabled={stockTypeLocked}
              onChange={(e) => set("stock_type", e.target.value as ProductFormValues["stock_type"])}
            >
              {(Object.keys(STOCK_TYPE_LABELS) as (keyof typeof STOCK_TYPE_LABELS)[]).map((t) => (
                <option key={t} value={t}>
                  {STOCK_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Brand" htmlFor="brand_id" error={errors.brand_id}>
            <Select id="brand_id" value={v.brand_id} onChange={(e) => set("brand_id", e.target.value)}>
              <option value="">— None —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.is_own_brand ? " (own brand)" : ""}
                </option>
              ))}
              <option value={NEW}>+ New brand…</option>
            </Select>
            {v.brand_id === NEW ? (
              <Input className="mt-2" placeholder="New brand name" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
            ) : null}
          </Field>
          <Field label="Category" htmlFor="category_id" error={errors.category_id}>
            <Select id="category_id" value={v.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW}>+ New category…</option>
            </Select>
            {v.category_id === NEW ? (
              <Input className="mt-2" placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            ) : null}
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description} className="sm:col-span-2 lg:col-span-3">
            <Textarea id="description" rows={2} value={v.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Tax and units" description="GST settings are sample configuration until approved by your accountant" />
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Unit of measure" htmlFor="uom" required error={errors.uom} hint="PCS, KG, LTR…">
            <Input id="uom" value={v.uom} onChange={(e) => set("uom", e.target.value.toUpperCase())} aria-invalid={!!errors.uom} />
          </Field>
          <Field label="HSN code" htmlFor="hsn" error={errors.hsn_code} hint="4, 6 or 8 digits">
            <Input id="hsn" inputMode="numeric" value={v.hsn_code} onChange={(e) => set("hsn_code", e.target.value)} aria-invalid={!!errors.hsn_code} />
          </Field>
          <Field label="GST rate" htmlFor="gst" required error={errors.gst_rate_code}>
            <Select id="gst" value={v.gst_rate_code} onChange={(e) => set("gst_rate_code", e.target.value)}>
              <option value="">Choose…</option>
              {rates.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} · {r.rate}%{r.is_sample ? " (sample)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Prices and stock control" />
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Purchase price (₹, excl. GST)" htmlFor="pp" error={errors.purchase_price}>
            <Input id="pp" type="number" min="0" step="0.01" value={v.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} />
          </Field>
          {!isRaw ? (
            <>
              <Field label="Retail price (₹, incl. GST)" htmlFor="rp" error={errors.retail_price} hint="Shelf price for walk-in customers">
                <Input id="rp" type="number" min="0" step="0.01" value={v.retail_price} onChange={(e) => set("retail_price", e.target.value)} aria-invalid={!!errors.retail_price} />
              </Field>
              <Field label="Wholesale price (₹, excl. GST)" htmlFor="wp" error={errors.wholesale_price}>
                <Input id="wp" type="number" min="0" step="0.01" value={v.wholesale_price} onChange={(e) => set("wholesale_price", e.target.value)} />
              </Field>
            </>
          ) : null}
          <Field label="Reorder level" htmlFor="rl" error={errors.reorder_level} hint="Low-stock alert at or below this">
            <Input id="rl" type="number" min="0" step="0.001" value={v.reorder_level} onChange={(e) => set("reorder_level", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-4">
            <Checkbox checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            Active (inactive products cannot be bought or sold)
          </label>
        </CardContent>
      </Card>

      {!productId ? (
        <Card>
          <CardHeader
            title="Opening stock (optional)"
            description="Recorded once as an opening-balance movement in the stock ledger. Use stock adjustments later."
          />
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Opening quantity" htmlFor="oq" error={errors.quantity}>
              <Input id="oq" type="number" min="0" step="0.001" value={opening.quantity} onChange={(e) => setOpening((o) => ({ ...o, quantity: e.target.value }))} />
            </Field>
            <Field label="Unit cost (₹)" htmlFor="oc" error={errors.unit_cost}>
              <Input id="oc" type="number" min="0" step="0.01" value={opening.unit_cost} onChange={(e) => setOpening((o) => ({ ...o, unit_cost: e.target.value }))} />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      <FormError message={formError} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : productId ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  )
}
