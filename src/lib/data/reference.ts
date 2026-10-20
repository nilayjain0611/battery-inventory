import { createClient } from "@/lib/supabase/server"
import { unwrap } from "./query"

export async function getStates() {
  const supabase = await createClient()
  return unwrap(await supabase.from("gst_states").select("code, name").order("name"), "States")
}

export async function getBrandsAndCategories() {
  const supabase = await createClient()
  const [brands, categories] = await Promise.all([
    supabase.from("brands").select("id, name, is_own_brand").order("is_own_brand", { ascending: false }).order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ])
  return { brands: unwrap(brands, "Brands"), categories: unwrap(categories, "Categories") }
}

export interface RateOption {
  code: string
  rate: number
  description: string
  is_sample: boolean
}

/** Latest version of each GST rate code effective on `onDate`. */
export async function getCurrentRates(onDate: string): Promise<RateOption[]> {
  const supabase = await createClient()
  const rows = unwrap(
    await supabase
      .from("gst_rates")
      .select("code, rate, description, is_sample, effective_from")
      .lte("effective_from", onDate)
      .order("code")
      .order("effective_from", { ascending: false }),
    "GST rates",
  )
  const seen = new Set<string>()
  const out: RateOption[] = []
  for (const r of rows) {
    if (seen.has(r.code)) continue
    seen.add(r.code)
    out.push({ code: r.code, rate: r.rate, description: r.description, is_sample: r.is_sample })
  }
  return out.sort((a, b) => a.rate - b.rate)
}

export async function getCompany() {
  const supabase = await createClient()
  return unwrap(await supabase.from("companies").select("*").limit(1).single(), "Company")
}
