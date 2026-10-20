import { createClient } from "@/lib/supabase/server"
import { likePattern } from "./inventory"
import { unwrap } from "./query"

export async function listCustomers(opts: { q?: string; type?: string; includeInactive?: boolean } = {}) {
  const supabase = await createClient()
  let query = supabase.from("v_customer_balances").select("*").order("is_walk_in", { ascending: false }).order("name")
  if (opts.q) query = query.ilike("name", likePattern(opts.q))
  if (opts.type === "retail" || opts.type === "wholesale") query = query.eq("customer_type", opts.type)
  if (!opts.includeInactive) query = query.eq("is_active", true)
  return unwrap(await query.limit(500), "Customers")
}

export async function listSuppliers(opts: { q?: string; includeInactive?: boolean } = {}) {
  const supabase = await createClient()
  let query = supabase.from("v_supplier_balances").select("*").order("name")
  if (opts.q) query = query.ilike("name", likePattern(opts.q))
  if (!opts.includeInactive) query = query.eq("is_active", true)
  return unwrap(await query.limit(500), "Suppliers")
}

export type CustomerRow = Awaited<ReturnType<typeof listCustomers>>[number]
export type SupplierRow = Awaited<ReturnType<typeof listSuppliers>>[number]
