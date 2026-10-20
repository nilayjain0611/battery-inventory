"use server"

import { refresh } from "next/cache"

import { getCurrentUser } from "@/lib/auth"
import { can } from "@/lib/domain/permissions"
import { cancelSchema, purchaseSchema, type PurchaseInput } from "@/lib/domain/schemas"
import { createClient } from "@/lib/supabase/server"
import { dbErrorMessage, fail, ok, validationFailure, type ActionResult } from "./result"

type PostResult = { id: string; number: string; duplicate: boolean }

export async function createPurchase(input: PurchaseInput): Promise<ActionResult<PostResult>> {
  const user = await getCurrentUser()
  if (!can(user.role, "purchases.create")) return fail("Your role cannot record purchases")
  const parsed = purchaseSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const supabase = await createClient()
  // All totals, taxes and stock effects are computed inside the database function.
  const res = await supabase.rpc("create_purchase", { p: parsed.data })
  if (res.error) return fail(dbErrorMessage(res.error))
  const out = res.data as unknown as PostResult
  return ok(out, out.duplicate ? `Purchase ${out.number} was already recorded` : `Purchase ${out.number} recorded and stock received`)
}

export async function cancelPurchase(input: { id: string; reason: string }): Promise<ActionResult<PostResult>> {
  const user = await getCurrentUser()
  if (!can(user.role, "purchases.cancel")) return fail("Only admin or accounts users can cancel purchases")
  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const supabase = await createClient()
  const res = await supabase.rpc("cancel_purchase", { p_id: parsed.data.id, p_reason: parsed.data.reason })
  if (res.error) return fail(dbErrorMessage(res.error))
  refresh()
  const out = res.data as unknown as PostResult
  return ok(out, `Purchase ${out.number} cancelled; stock reversed`)
}
