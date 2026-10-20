"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { getCurrentUser } from "@/lib/auth"
import { can } from "@/lib/domain/permissions"
import { companySchema, gstRateSchema, membershipSchema, sequenceSchema } from "@/lib/domain/schemas"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { dbErrorMessage, fail, ok, validationFailure, type ActionResult } from "./result"

async function requireAdmin() {
  const user = await getCurrentUser()
  return can(user.role, "settings.manage") ? user : null
}

export async function updateCompany(input: z.input<typeof companySchema>): Promise<ActionResult<null>> {
  const user = await requireAdmin()
  if (!user) return fail("Only the owner/admin can change company settings")
  const parsed = companySchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const supabase = await createClient()
  const { data, error } = await supabase.from("companies").update(parsed.data).eq("id", user.companyId).select("id")
  if (error) return fail(dbErrorMessage(error))
  if (!data?.length) return fail("Company not updated")
  refresh()
  return ok(null, "Company settings saved. New invoices will use these details.")
}

export async function addGstRateVersion(input: z.input<typeof gstRateSchema>): Promise<ActionResult<null>> {
  const user = await requireAdmin()
  if (!user) return fail("Only the owner/admin can change tax settings")
  const parsed = gstRateSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const supabase = await createClient()
  const { error } = await supabase.from("gst_rates").insert({ ...parsed.data, company_id: user.companyId, created_by: user.id })
  if (error) return fail(dbErrorMessage(error))
  refresh()
  return ok(null, `${parsed.data.code} at ${parsed.data.rate}% effective ${parsed.data.effective_from} added`)
}

export async function markRateVerified(input: { id: string; verified: boolean }): Promise<ActionResult<null>> {
  const user = await requireAdmin()
  if (!user) return fail("Only the owner/admin can change tax settings")
  const supabase = await createClient()
  const { error } = await supabase.from("gst_rates").update({ is_sample: !input.verified }).eq("id", input.id)
  if (error) return fail(dbErrorMessage(error))
  refresh()
  return ok(null, input.verified ? "Rate marked as verified by accountant" : "Rate marked as sample")
}

export async function updateSequence(input: z.input<typeof sequenceSchema>): Promise<ActionResult<null>> {
  const user = await requireAdmin()
  if (!user) return fail("Only the owner/admin can change document numbering")
  const parsed = sequenceSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const supabase = await createClient()
  const { error } = await supabase
    .from("document_sequences")
    .update({ prefix: parsed.data.prefix, padding: parsed.data.padding })
    .eq("id", parsed.data.id)
  if (error) return fail(dbErrorMessage(error))
  refresh()
  return ok(null, "Numbering updated for future documents")
}

export async function updateMembership(input: z.input<typeof membershipSchema>): Promise<ActionResult<null>> {
  const user = await requireAdmin()
  if (!user) return fail("Only the owner/admin can manage users")
  const parsed = membershipSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const supabase = await createClient()
  const { data: target } = await supabase.from("company_memberships").select("user_id").eq("id", parsed.data.id).maybeSingle()
  if (!target) return fail("User not found")
  if (target.user_id === user.id && (parsed.data.role !== "admin" || !parsed.data.is_active)) {
    return fail("You cannot remove your own admin access")
  }
  const { error } = await supabase
    .from("company_memberships")
    .update({ role: parsed.data.role, can_record_receipts: parsed.data.can_record_receipts, is_active: parsed.data.is_active })
    .eq("id", parsed.data.id)
  if (error) return fail(dbErrorMessage(error))
  refresh()
  return ok(null, "User access updated")
}

const newUserSchema = z.object({
  full_name: z.string().trim().min(2, { error: "Enter a name" }).max(120),
  email: z.email({ error: "Enter a valid email" }),
  password: z.string().min(10, { error: "Use at least 10 characters" }).max(72),
  role: membershipSchema.shape.role,
})

export async function createUser(input: z.input<typeof newUserSchema>): Promise<ActionResult<null>> {
  const user = await requireAdmin()
  if (!user) return fail("Only the owner/admin can add users")
  const parsed = newUserSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const admin = createAdminClient()
  if (!admin) return fail("SUPABASE_SERVICE_ROLE_KEY is not configured on the server; add users from the Supabase dashboard instead.")

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  })
  if (error || !data.user) return fail(error?.message ?? "Could not create the user")

  // Membership is written with the admin's own session, so RLS applies.
  const supabase = await createClient()
  const { error: memberError } = await supabase.from("company_memberships").insert({
    company_id: user.companyId,
    user_id: data.user.id,
    role: parsed.data.role,
    can_record_receipts: parsed.data.role === "sales" ? false : true,
  })
  if (memberError) return fail(`User created but not linked to the company: ${dbErrorMessage(memberError)}`)
  refresh()
  return ok(null, `${parsed.data.email} can now sign in`)
}
