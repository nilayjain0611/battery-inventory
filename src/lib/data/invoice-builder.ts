import { getProductOptions } from "./inventory"
import { listCustomers } from "./parties"
import { getCompany, getCurrentRates, getStates } from "./reference"
import type { BuilderCustomer, BuilderProduct } from "@/components/sales/invoice-builder"

/** Everything the invoice builder needs, with GST rates effective on `onDate`. */
export async function getInvoiceBuilderData(onDate: string) {
  const [customers, products, states, company, rates] = await Promise.all([
    listCustomers(),
    getProductOptions(["manufactured", "trading"]),
    getStates(),
    getCompany(),
    getCurrentRates(onDate),
  ])
  const rateByCode = new Map(rates.map((r) => [r.code, r.rate]))
  return {
    company,
    states,
    customers: customers.map<BuilderCustomer>((c) => ({
      id: c.id ?? "",
      name: c.name ?? "",
      customer_type: c.customer_type ?? "retail",
      is_walk_in: c.is_walk_in ?? false,
      state_code: c.state_code ?? company.state_code,
      gstin: c.gstin,
      billing_address: c.billing_address,
      shipping_address: c.shipping_address,
      credit_days: c.credit_days ?? 0,
      outstanding: Number(c.outstanding ?? 0),
    })),
    products: products.map<BuilderProduct>((p) => ({
      id: p.id ?? "",
      sku: p.sku ?? "",
      name: p.name ?? "",
      stock_type: p.stock_type ?? "trading",
      uom: p.uom ?? "",
      quantity: Number(p.quantity ?? 0),
      brand_name: p.brand_name,
      retail_price: Number(p.retail_price ?? 0),
      wholesale_price: Number(p.wholesale_price ?? 0),
      gst_rate: rateByCode.get(p.gst_rate_code ?? "") ?? 0,
      hsn_code: p.hsn_code,
    })),
  }
}
