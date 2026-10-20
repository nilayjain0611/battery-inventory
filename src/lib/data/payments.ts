import { createClient } from "@/lib/supabase/server"
import { unwrap } from "./query"

export async function listPayments(opts: { direction?: string; from?: string; to?: string; method?: string }) {
  const supabase = await createClient()
  let query = supabase.from("v_payments").select("*").order("payment_date", { ascending: false }).order("created_at", { ascending: false })
  if (opts.direction === "receipt" || opts.direction === "payment") query = query.eq("direction", opts.direction)
  if (opts.from) query = query.gte("payment_date", opts.from)
  if (opts.to) query = query.lte("payment_date", opts.to)
  if (opts.method) query = query.eq("method", opts.method as "cash")
  return unwrap(await query.limit(300), "Payments")
}

/** Posted documents with a balance, for allocation. */
export async function getOpenDocuments() {
  const supabase = await createClient()
  const [invoices, purchases] = await Promise.all([
    supabase
      .from("v_sales_invoices")
      .select("id, invoice_number, customer_id, invoice_date, due_date, grand_total, amount_paid, balance_due")
      .eq("status", "posted")
      .gt("balance_due", 0)
      .order("invoice_date"),
    supabase
      .from("v_purchases")
      .select("id, purchase_number, supplier_id, purchase_date, supplier_invoice_number, grand_total, amount_paid, balance_due")
      .eq("status", "posted")
      .gt("balance_due", 0)
      .order("purchase_date"),
  ])
  return { invoices: unwrap(invoices, "Open invoices"), purchases: unwrap(purchases, "Open purchases") }
}
