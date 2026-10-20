"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { getCurrentUser } from "@/lib/auth"
import { can } from "@/lib/domain/permissions"
import { id, openingStockSchema, productSchema, stockAdjustmentSchema, type ProductInput } from "@/lib/domain/schemas"
import { createClient } from "@/lib/supabase/server"
import { dbErrorMessage, fail, ok, validationFailure, type ActionResult } from "./result"

const newNameSchema = z.string().trim().min(2, { error: "Name is too short" }).max(80)

async function resolveBrandAndCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  newBrand: string | undefined,
  newCategory: string | undefined,
  ownBrand: boolean,
): Promise<{ brandId?: string; categoryId?: string; error?: string }> {
  const out: { brandId?: string; categoryId?: string; error?: string } = {}
  if (newBrand) {
    const name = newNameSchema.safeParse(newBrand)
    if (!name.success) return { error: `Brand: ${name.error.issues[0]?.message}` }
    const { data, error } = await supabase
      .from("brands")
      .insert({ company_id: companyId, name: name.data, is_own_brand: ownBrand })
      .select("id")
      .single()
    if (error) return { error: dbErrorMessage(error) }
    out.brandId = data.id
  }
  if (newCategory) {
    const name = newNameSchema.safeParse(newCategory)
    if (!name.success) return { error: `Category: ${name.error.issues[0]?.message}` }
    const { data, error } = await supabase
      .from("categories")
      .insert({ company_id: companyId, name: name.data })
      .select("id")
      .single()
    if (error) return { error: dbErrorMessage(error) }
    out.categoryId = data.id
  }
  return out
}

export async function createProduct(input: {
  product: ProductInput
  newBrand?: string
  newCategory?: string
  opening?: { quantity: number | string; unit_cost: number | string } | null
}): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "products.manage")) return fail("Your role cannot create products")

  const parsed = productSchema.safeParse(input.product)
  if (!parsed.success) return validationFailure(parsed.error)
  const opening = input.opening ? openingStockSchema.safeParse(input.opening) : null
  if (opening && !opening.success) return validationFailure(opening.error)

  const supabase = await createClient()
  const extra = await resolveBrandAndCategory(
    supabase,
    user.companyId,
    input.newBrand,
    input.newCategory,
    parsed.data.stock_type === "manufactured",
  )
  if (extra.error) return fail(extra.error)

  const { data, error } = await supabase
    .from("products")
    .insert({
      ...parsed.data,
      brand_id: extra.brandId ?? parsed.data.brand_id,
      category_id: extra.categoryId ?? parsed.data.category_id,
      company_id: user.companyId,
      created_by: user.id,
    })
    .select("id")
    .single()
  if (error) return fail(dbErrorMessage(error), error.code === "23505" ? { sku: ["This SKU is already used"] } : undefined)

  if (opening?.success) {
    const res = await supabase.rpc("record_opening_stock", {
      p_product: data.id,
      p_quantity: opening.data.quantity,
      p_unit_cost: opening.data.unit_cost,
    })
    if (res.error) {
      return ok({ id: data.id }, `Product created, but opening stock was not recorded: ${dbErrorMessage(res.error)}`)
    }
  }
  return ok({ id: data.id }, `Product ${parsed.data.sku} created`)
}

export async function updateProduct(input: {
  id: string
  product: ProductInput
  newBrand?: string
  newCategory?: string
}): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "products.manage")) return fail("Your role cannot edit products")
  const productId = id.safeParse(input.id)
  if (!productId.success) return fail("Invalid product")
  const parsed = productSchema.safeParse(input.product)
  if (!parsed.success) return validationFailure(parsed.error)

  const supabase = await createClient()
  const extra = await resolveBrandAndCategory(
    supabase,
    user.companyId,
    input.newBrand,
    input.newCategory,
    parsed.data.stock_type === "manufactured",
  )
  if (extra.error) return fail(extra.error)

  // Stock type is fixed once movements exist (it changes how stock is used).
  const { count } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId.data)
  const { data: current } = await supabase.from("products").select("stock_type").eq("id", productId.data).maybeSingle()
  if (!current) return fail("Product not found")
  if ((count ?? 0) > 0 && current.stock_type !== parsed.data.stock_type) {
    return fail("Stock type cannot change after stock has moved", { stock_type: ["Locked: this product has stock history"] })
  }

  const { error, data } = await supabase
    .from("products")
    .update({
      ...parsed.data,
      brand_id: extra.brandId ?? parsed.data.brand_id,
      category_id: extra.categoryId ?? parsed.data.category_id,
    })
    .eq("id", productId.data)
    .select("id")
  if (error) return fail(dbErrorMessage(error), error.code === "23505" ? { sku: ["This SKU is already used"] } : undefined)
  if (!data?.length) return fail("You do not have permission to edit this product")
  refresh()
  return ok({ id: productId.data }, "Product updated")
}

export async function adjustStock(input: z.input<typeof stockAdjustmentSchema>): Promise<ActionResult<{ number: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "stock.adjust")) return fail("Your role cannot adjust stock")
  const parsed = stockAdjustmentSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const a = parsed.data
  const supabase = await createClient()
  const res = await supabase.rpc("post_stock_adjustment", {
    p: {
      idempotency_key: a.idempotency_key,
      product_id: a.product_id,
      quantity_delta: a.direction === "increase" ? a.quantity : -a.quantity,
      unit_cost: a.direction === "increase" ? (a.unit_cost ?? null) : null,
      reason: a.reason,
      adjustment_date: a.adjustment_date,
    },
  })
  if (res.error) return fail(dbErrorMessage(res.error))
  const out = res.data as { number: string; duplicate: boolean }
  refresh()
  return ok({ number: out.number }, `Adjustment ${out.number} recorded`)
}
