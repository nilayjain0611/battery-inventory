"use server"

import { refresh } from "next/cache"

import { getCurrentUser } from "@/lib/auth"
import { can } from "@/lib/domain/permissions"
import { customerSchema, id, supplierSchema, type CustomerInput, type SupplierInput } from "@/lib/domain/schemas"
import { createClient } from "@/lib/supabase/server"
import { dbErrorMessage, fail, ok, validationFailure, type ActionResult } from "./result"

export async function saveCustomer(input: { id?: string; values: CustomerInput }): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "customers.manage")) return fail("Your role cannot manage customers")
  const parsed = customerSchema.safeParse(input.values)
  if (!parsed.success) return validationFailure(parsed.error)
  const supabase = await createClient()

  if (input.id) {
    const customerId = id.safeParse(input.id)
    if (!customerId.success) return fail("Invalid customer")
    const { data, error } = await supabase.from("customers").update(parsed.data).eq("id", customerId.data).select("id, is_walk_in")
    if (error) return fail(dbErrorMessage(error), error.code === "23505" ? { name: ["Name already used"] } : undefined)
    if (!data?.length) return fail("Customer not found or not editable")
    refresh()
    return ok({ id: customerId.data }, "Customer updated")
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({ ...parsed.data, company_id: user.companyId, created_by: user.id })
    .select("id")
    .single()
  if (error) return fail(dbErrorMessage(error), error.code === "23505" ? { name: ["Name already used"] } : undefined)
  refresh()
  return ok({ id: data.id }, `Customer ${parsed.data.name} added`)
}

export async function saveSupplier(input: { id?: string; values: SupplierInput }): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "suppliers.manage")) return fail("Your role cannot manage suppliers")
  const parsed = supplierSchema.safeParse(input.values)
  if (!parsed.success) return validationFailure(parsed.error)
  const supabase = await createClient()

  if (input.id) {
    const supplierId = id.safeParse(input.id)
    if (!supplierId.success) return fail("Invalid supplier")
    const { data, error } = await supabase.from("suppliers").update(parsed.data).eq("id", supplierId.data).select("id")
    if (error) return fail(dbErrorMessage(error), error.code === "23505" ? { name: ["Name already used"] } : undefined)
    if (!data?.length) return fail("Supplier not found or not editable")
    refresh()
    return ok({ id: supplierId.data }, "Supplier updated")
  }

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...parsed.data, company_id: user.companyId, created_by: user.id })
    .select("id")
    .single()
  if (error) return fail(dbErrorMessage(error), error.code === "23505" ? { name: ["Name already used"] } : undefined)
  refresh()
  return ok({ id: data.id }, `Supplier ${parsed.data.name} added`)
}
