"use server"

import { refresh } from "next/cache"
import type { z } from "zod"

import { getCurrentUser } from "@/lib/auth"
import { can } from "@/lib/domain/permissions"
import { cancelSchema, completeProductionSchema, productionOrderSchema } from "@/lib/domain/schemas"
import { createClient } from "@/lib/supabase/server"
import { dbErrorMessage, fail, ok, validationFailure, type ActionResult } from "./result"

export async function createProductionOrder(
  input: z.input<typeof productionOrderSchema>,
): Promise<ActionResult<{ id: string; number: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "production.manage")) return fail("Your role cannot plan production")
  const parsed = productionOrderSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const supabase = await createClient()
  const res = await supabase.rpc("create_production_order", { p: parsed.data })
  if (res.error) return fail(dbErrorMessage(res.error))
  const out = res.data as unknown as { id: string; number: string }
  return ok(out, `Production order ${out.number} created`)
}

export async function completeProductionOrder(
  input: z.input<typeof completeProductionSchema>,
): Promise<ActionResult<{ number: string; material_cost: number }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "production.manage")) return fail("Your role cannot complete production")
  const parsed = completeProductionSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const { id, ...rest } = parsed.data
  const supabase = await createClient()
  const res = await supabase.rpc("complete_production_order", { p_id: id, p: rest })
  if (res.error) return fail(dbErrorMessage(res.error))
  refresh()
  const out = res.data as unknown as { number: string; material_cost: number }
  return ok(out, `${out.number} completed: materials consumed and finished stock added`)
}

export async function cancelProductionOrder(input: { id: string; reason: string }): Promise<ActionResult<null>> {
  const user = await getCurrentUser()
  if (!can(user.role, "production.manage")) return fail("Your role cannot cancel production")
  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const supabase = await createClient()
  const res = await supabase.rpc("cancel_production_order", { p_id: parsed.data.id, p_reason: parsed.data.reason })
  if (res.error) return fail(dbErrorMessage(res.error))
  refresh()
  return ok(null, "Production order cancelled")
}
