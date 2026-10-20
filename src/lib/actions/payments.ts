"use server"

import { getCurrentUser } from "@/lib/auth"
import { can, canRecordReceipts } from "@/lib/domain/permissions"
import { paymentSchema, type PaymentInput } from "@/lib/domain/schemas"
import { createClient } from "@/lib/supabase/server"
import { dbErrorMessage, fail, ok, validationFailure, type ActionResult } from "./result"

export async function recordPayment(input: PaymentInput): Promise<ActionResult<{ id: string; number: string; duplicate: boolean }>> {
  const user = await getCurrentUser()
  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const p = parsed.data
  if (p.direction === "receipt" && !canRecordReceipts(user.role, user.canRecordReceipts)) {
    return fail("You do not have permission to record customer receipts")
  }
  if (p.direction === "payment" && !can(user.role, "payments.supplier")) {
    return fail("Only admin or accounts users can record supplier payments")
  }

  const supabase = await createClient()
  // The database checks every allocation against the live balance under a row
  // lock, so concurrent or repeated submissions cannot over-allocate.
  const res = await supabase.rpc("record_payment", {
    p: {
      idempotency_key: p.idempotency_key,
      direction: p.direction,
      customer_id: p.direction === "receipt" ? p.party_id : null,
      supplier_id: p.direction === "payment" ? p.party_id : null,
      payment_date: p.payment_date,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      allocations: p.allocations,
    },
  })
  if (res.error) return fail(dbErrorMessage(res.error))
  const out = res.data as unknown as { id: string; number: string; duplicate: boolean }
  return ok(out, out.duplicate ? `Payment ${out.number} was already recorded` : `Payment ${out.number} recorded`)
}
