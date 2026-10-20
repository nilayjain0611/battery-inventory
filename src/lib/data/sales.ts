import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/database.types"
import { unwrap } from "./query"

export async function listInvoices(opts: {
  customerId?: string
  status?: string
  from?: string
  to?: string
  q?: string
  saleType?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from("v_sales_invoices")
    .select("*")
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (opts.customerId) query = query.eq("customer_id", opts.customerId)
  if (opts.status === "draft" || opts.status === "cancelled") query = query.eq("status", opts.status)
  if (opts.status && ["paid", "partial", "unpaid", "overdue"].includes(opts.status)) {
    query = query.eq("payment_status", opts.status)
  }
  if (opts.status === "outstanding") query = query.eq("status", "posted").gt("balance_due", 0)
  if (opts.saleType === "retail" || opts.saleType === "wholesale") query = query.eq("sale_type", opts.saleType)
  if (opts.from) query = query.gte("invoice_date", opts.from)
  if (opts.to) query = query.lte("invoice_date", opts.to)
  if (opts.q) query = query.ilike("invoice_number", `%${opts.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
  return unwrap(await query.limit(300), "Invoices")
}

export type InvoiceHeader = Tables<"sales_invoices">
export type InvoiceLine = Tables<"sales_lines">

export interface SellerSnapshot {
  name: string
  legal_name: string
  gstin: string | null
  state_code: string
  state_name: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  pincode: string | null
  phone: string | null
  email: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  invoice_terms: string | null
  invoice_footer: string | null
  is_demo_configuration: boolean
  gst_rates_sample: boolean
}

export async function getInvoice(id: string) {
  const supabase = await createClient()
  const [header, lines, allocations] = await Promise.all([
    supabase.from("sales_invoices").select("*").eq("id", id).maybeSingle(),
    supabase.from("sales_lines").select("*").eq("invoice_id", id).order("line_no"),
    supabase.from("payment_allocations").select("payment_id, amount").eq("sales_invoice_id", id),
  ])
  if (header.error) throw new Error(`Invoice: ${header.error.message}`)
  if (!header.data) return null
  const allocs = unwrap(allocations, "Allocations")
  const payments = allocs.length
    ? unwrap(
        await supabase
          .from("v_payments")
          .select("*")
          .in("id", allocs.map((a) => a.payment_id))
          .order("payment_date"),
        "Payments",
      )
    : []
  const allocatedById = new Map(allocs.map((a) => [a.payment_id, a.amount]))
  const [{ data: states }, { data: creator }] = await Promise.all([
    supabase.from("gst_states").select("code, name"),
    header.data.posted_by
      ? supabase.from("profiles").select("full_name").eq("id", header.data.posted_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  // Posted invoices carry a frozen seller snapshot; drafts preview the current company.
  let seller = header.data.seller_snapshot as unknown as SellerSnapshot | null
  if (!seller) {
    const [{ data: company }, { count: sampleRates }] = await Promise.all([
      supabase.from("companies").select("*").eq("id", header.data.company_id).maybeSingle(),
      supabase.from("gst_rates").select("id", { count: "exact", head: true }).eq("is_sample", true),
    ])
    if (company) {
      seller = {
        name: company.name,
        legal_name: company.legal_name,
        gstin: company.gstin,
        state_code: company.state_code,
        state_name: (states ?? []).find((s) => s.code === company.state_code)?.name ?? "",
        address_line1: company.address_line1,
        address_line2: company.address_line2,
        city: company.city,
        pincode: company.pincode,
        phone: company.phone,
        email: company.email,
        bank_name: company.bank_name,
        bank_account_number: company.bank_account_number,
        bank_ifsc: company.bank_ifsc,
        invoice_terms: company.invoice_terms,
        invoice_footer: company.invoice_footer,
        is_demo_configuration: company.is_demo_configuration,
        gst_rates_sample: (sampleRates ?? 0) > 0,
      }
    }
  }
  return {
    invoice: header.data,
    seller,
    lines: unwrap(lines, "Invoice lines"),
    payments: payments.map((p) => ({ ...p, allocated: allocatedById.get(p.id ?? "") ?? 0 })),
    stateName: new Map((states ?? []).map((s) => [s.code, s.name])),
    postedByName: creator?.full_name ?? null,
  }
}
export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>
