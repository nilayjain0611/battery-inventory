import { createClient } from "@/lib/supabase/server"
import type { Views } from "@/lib/database.types"
import { unwrap } from "./query"

export type ProductStockRow = Views<"v_product_stock">
export type MovementRow = Views<"v_stock_movements">

/** Escapes LIKE wildcards in user input. */
export function likePattern(term: string): string {
  return `%${term.toLowerCase().replace(/[\\%_]/g, (m) => `\\${m}`)}%`
}

export async function listProducts(opts: { q?: string; type?: string; filter?: string; activeOnly?: boolean }) {
  const supabase = await createClient()
  let query = supabase.from("v_product_stock").select("*").order("stock_type").order("sku")
  if (opts.q) query = query.ilike("search_text", likePattern(opts.q))
  if (opts.type === "raw_material" || opts.type === "manufactured" || opts.type === "trading") {
    query = query.eq("stock_type", opts.type)
  }
  if (opts.filter === "low") query = query.eq("is_low_stock", true)
  if (opts.filter === "inactive") query = query.eq("is_active", false)
  else if (opts.activeOnly || opts.filter !== "all") query = query.eq("is_active", true)
  return unwrap(await query.limit(500), "Products")
}

export async function getProduct(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("v_product_stock").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`Product: ${error.message}`)
  return data
}

export async function getProductMovements(productId: string) {
  const supabase = await createClient()
  return unwrap(
    await supabase
      .from("v_stock_movements")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: true })
      .limit(1000),
    "Movements",
  )
}

export async function listMovements(opts: {
  productId?: string
  type?: string
  from?: string
  to?: string
  limit: number
}) {
  const supabase = await createClient()
  let query = supabase
    .from("v_stock_movements")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
  if (opts.productId) query = query.eq("product_id", opts.productId)
  if (opts.type) query = query.eq("movement_type", opts.type as MovementRow["movement_type"] & string)
  if (opts.from) query = query.gte("movement_date", opts.from)
  if (opts.to) query = query.lte("movement_date", opts.to)
  const res = await query.limit(opts.limit)
  if (res.error) throw new Error(`Movements: ${res.error.message}`)
  return { rows: res.data ?? [], total: res.count ?? 0 }
}

export async function getReconciliationIssues() {
  const supabase = await createClient()
  return unwrap(
    await supabase.from("v_stock_reconciliation").select("product_id, sku, difference").neq("difference", 0),
    "Reconciliation",
  )
}

/** Products for pickers (selectors in forms). */
export async function getProductOptions(types?: ("raw_material" | "manufactured" | "trading")[]) {
  const supabase = await createClient()
  let query = supabase
    .from("v_product_stock")
    .select("id, sku, name, stock_type, uom, hsn_code, gst_rate_code, purchase_price, retail_price, wholesale_price, quantity, avg_cost, brand_name, is_own_brand")
    .eq("is_active", true)
    .order("stock_type")
    .order("name")
  if (types?.length) query = query.in("stock_type", types)
  return unwrap(await query, "Products")
}
export type ProductOption = Awaited<ReturnType<typeof getProductOptions>>[number]
