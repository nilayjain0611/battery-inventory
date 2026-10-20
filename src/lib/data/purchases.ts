import { createClient } from "@/lib/supabase/server"
import { unwrap } from "./query"

export async function listPurchases(opts: { supplierId?: string; from?: string; to?: string; status?: string }) {
  const supabase = await createClient()
  let query = supabase.from("v_purchases").select("*").order("purchase_date", { ascending: false }).order("created_at", { ascending: false })
  if (opts.supplierId) query = query.eq("supplier_id", opts.supplierId)
  if (opts.from) query = query.gte("purchase_date", opts.from)
  if (opts.to) query = query.lte("purchase_date", opts.to)
  if (opts.status === "posted" || opts.status === "cancelled") query = query.eq("status", opts.status)
  if (opts.status === "unpaid") query = query.eq("status", "posted").gt("balance_due", 0)
  return unwrap(await query.limit(300), "Purchases")
}

export async function getPurchase(id: string) {
  const supabase = await createClient()
  const [header, lines, allocations] = await Promise.all([
    supabase.from("v_purchases").select("*").eq("id", id).maybeSingle(),
    supabase.from("purchase_lines").select("*").eq("purchase_id", id).order("line_no"),
    supabase
      .from("payment_allocations")
      .select("id, amount, payment_id, created_at")
      .eq("purchase_id", id)
      .order("created_at"),
  ])
  if (header.error) throw new Error(`Purchase: ${header.error.message}`)
  if (!header.data) return null
  const paymentIds = (unwrap(allocations, "Allocations") ?? []).map((a) => a.payment_id)
  const payments = paymentIds.length
    ? unwrap(await supabase.from("v_payments").select("*").in("id", paymentIds), "Payments")
    : []
  return { purchase: header.data, lines: unwrap(lines, "Purchase lines"), allocations: allocations.data ?? [], payments }
}
