"use server"

import { refresh } from "next/cache"

import { getCurrentUser } from "@/lib/auth"
import { can } from "@/lib/domain/permissions"
import { cancelSchema, id, invoiceSchema, type InvoiceInput } from "@/lib/domain/schemas"
import { createClient } from "@/lib/supabase/server"
import { dbErrorMessage, fail, ok, validationFailure, type ActionResult } from "./result"

type InvoiceResult = { id: string; number: string | null; status: "draft" | "posted" | "cancelled"; duplicate: boolean }

/**
 * Saves an invoice as a draft or saves-and-posts it. The client's figures are
 * never sent: the database recomputes every line, tax and total, checks and
 * consumes stock under row locks, and allocates the number atomically.
 */
export async function saveInvoice(input: { id?: string; values: InvoiceInput; post: boolean }): Promise<ActionResult<InvoiceResult>> {
  const user = await getCurrentUser()
  if (!can(user.role, "sales.create")) return fail("Your role cannot create invoices")
  const parsed = invoiceSchema.safeParse(input.values)
  if (!parsed.success) return validationFailure(parsed.error)

  const supabase = await createClient()
  let res
  if (input.id) {
    const invoiceId = id.safeParse(input.id)
    if (!invoiceId.success) return fail("Invalid invoice")
    res = await supabase.rpc("update_sales_invoice_draft", { p_id: invoiceId.data, p: parsed.data, p_post: input.post })
  } else {
    res = await supabase.rpc("create_sales_invoice", { p: parsed.data, p_post: input.post })
  }
  if (res.error) return fail(dbErrorMessage(res.error))
  const out = res.data as unknown as InvoiceResult
  const message =
    out.status === "posted"
      ? out.duplicate
        ? `Invoice ${out.number} was already posted`
        : `Invoice ${out.number} posted; stock updated`
      : "Draft saved"
  return ok(out, message)
}

export async function postInvoice(input: { id: string }): Promise<ActionResult<InvoiceResult>> {
  const user = await getCurrentUser()
  if (!can(user.role, "sales.create")) return fail("Your role cannot post invoices")
  const invoiceId = id.safeParse(input.id)
  if (!invoiceId.success) return fail("Invalid invoice")
  const supabase = await createClient()
  const res = await supabase.rpc("post_sales_invoice", { p_id: invoiceId.data })
  if (res.error) return fail(dbErrorMessage(res.error))
  refresh()
  const out = res.data as unknown as InvoiceResult
  return ok(out, out.duplicate ? `Invoice ${out.number} was already posted` : `Invoice ${out.number} posted; stock updated`)
}

export async function cancelInvoice(input: { id: string; reason: string }): Promise<ActionResult<InvoiceResult>> {
  const user = await getCurrentUser()
  if (!can(user.role, "sales.create")) return fail("Your role cannot cancel invoices")
  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const supabase = await createClient()
  const res = await supabase.rpc("cancel_sales_invoice", { p_id: parsed.data.id, p_reason: parsed.data.reason })
  if (res.error) return fail(dbErrorMessage(res.error))
  refresh()
  const out = res.data as unknown as InvoiceResult
  return ok(out, out.number ? `Invoice ${out.number} cancelled; stock returned` : "Draft discarded")
}
