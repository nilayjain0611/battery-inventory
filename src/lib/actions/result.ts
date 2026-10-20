import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message }
}

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResult<never> {
  return { ok: false, error, fieldErrors }
}

export function validationFailure(error: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(error)
  const first = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0]
  return {
    ok: false,
    error: typeof first === "string" ? first : "Please check the highlighted fields",
    fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
  }
}

const UNIQUE_MESSAGES: Record<string, string> = {
  products_company_id_sku_key: "A product with this SKU already exists",
  customers_company_id_name_key: "A customer with this name already exists",
  suppliers_company_id_name_key: "A supplier with this name already exists",
  categories_company_id_name_key: "This category already exists",
  brands_company_id_name_key: "This brand already exists",
  gst_rates_company_id_code_effective_from_key: "A version of this rate already exists for that date",
  boms_company_id_name_key: "A bill of materials with this name already exists",
}

/** Turns a database error into a message that is safe and useful to show. */
export function dbErrorMessage(error: PostgrestError | null | undefined): string {
  if (!error) return "Something went wrong"
  switch (error.code) {
    case "42501":
      return error.message.startsWith("permission denied") || error.message.includes("row-level security")
        ? "You do not have permission to do this"
        : error.message
    case "23505": {
      const constraint = Object.keys(UNIQUE_MESSAGES).find((k) => error.message.includes(k))
      return constraint ? UNIQUE_MESSAGES[constraint] : "This record already exists"
    }
    case "23514":
      return "Some values are not valid. Check formats such as GSTIN, PIN code, SKU and HSN."
    case "23503":
      return "This refers to a record that does not exist"
    case "22P02":
      return "One of the values has an invalid format"
    case "P0001":
      return error.message
    default:
      console.error("Database error", error)
      return error.message || "Something went wrong"
  }
}
