import { createClient } from "@/lib/supabase/server"
import { unwrap } from "./query"

export async function listProductionOrders(status?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("v_production_orders")
    .select("*")
    .order("production_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (status === "draft" || status === "completed" || status === "cancelled") query = query.eq("status", status)
  return unwrap(await query.limit(300), "Production orders")
}

export interface BomWithLines {
  id: string
  name: string
  product_id: string
  product_name: string
  product_sku: string
  output_quantity: number
  is_active: boolean
  notes: string | null
  lines: { component_product_id: string; quantity: number; sku: string; name: string; uom: string; available: number; avg_cost: number }[]
}

export async function listBoms(): Promise<BomWithLines[]> {
  const supabase = await createClient()
  const [boms, lines, stock] = await Promise.all([
    supabase.from("boms").select("id, name, product_id, output_quantity, is_active, notes").order("name"),
    supabase.from("bom_lines").select("bom_id, component_product_id, quantity"),
    supabase.from("v_product_stock").select("id, sku, name, uom, quantity, avg_cost"),
  ])
  const stockById = new Map(unwrap(stock, "Stock").map((s) => [s.id, s]))
  const allLines = unwrap(lines, "BOM lines")
  return unwrap(boms, "BOMs").map((b) => {
    const product = stockById.get(b.product_id)
    return {
      ...b,
      product_name: product?.name ?? "",
      product_sku: product?.sku ?? "",
      lines: allLines
        .filter((l) => l.bom_id === b.id)
        .map((l) => {
          const c = stockById.get(l.component_product_id)
          return {
            component_product_id: l.component_product_id,
            quantity: l.quantity,
            sku: c?.sku ?? "",
            name: c?.name ?? "",
            uom: c?.uom ?? "",
            available: Number(c?.quantity ?? 0),
            avg_cost: Number(c?.avg_cost ?? 0),
          }
        }),
    }
  })
}

export async function getProductionOrder(id: string) {
  const supabase = await createClient()
  const [order, materials] = await Promise.all([
    supabase.from("v_production_orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("production_materials").select("*").eq("production_order_id", id),
  ])
  if (order.error) throw new Error(`Production order: ${order.error.message}`)
  if (!order.data) return null
  const mats = unwrap(materials, "Materials")
  const stock = mats.length
    ? unwrap(
        await supabase
          .from("v_product_stock")
          .select("id, sku, name, uom, quantity, avg_cost")
          .in("id", mats.map((m) => m.product_id)),
        "Stock",
      )
    : []
  const byId = new Map(stock.map((s) => [s.id, s]))
  return {
    order: order.data,
    materials: mats
      .map((m) => ({ ...m, product: byId.get(m.product_id) }))
      .sort((a, b) => (a.product?.sku ?? "").localeCompare(b.product?.sku ?? "")),
  }
}
