import type { InvoiceDetail } from "@/lib/data/sales"
import { amountInWords, dec } from "./money"

/**
 * One presentation model for the on-screen invoice and the PDF, built only
 * from the persisted invoice snapshot (never from form input).
 */
export function buildInvoiceModel(detail: InvoiceDetail) {
  const { invoice, seller, lines, stateName } = detail
  const intra = invoice.supply_type === "intra_state"

  const byRate = new Map<string, { rate: number; taxable: ReturnType<typeof dec>; cgst: ReturnType<typeof dec>; sgst: ReturnType<typeof dec>; igst: ReturnType<typeof dec> }>()
  for (const l of lines) {
    const k = String(l.gst_rate)
    const row = byRate.get(k) ?? { rate: Number(l.gst_rate), taxable: dec(0), cgst: dec(0), sgst: dec(0), igst: dec(0) }
    row.taxable = row.taxable.plus(dec(l.taxable_value))
    row.cgst = row.cgst.plus(dec(l.cgst_amount))
    row.sgst = row.sgst.plus(dec(l.sgst_amount))
    row.igst = row.igst.plus(dec(l.igst_amount))
    byRate.set(k, row)
  }

  const sellerAddress = seller
    ? [seller.address_line1, seller.address_line2, [seller.city, seller.pincode].filter(Boolean).join(" "), seller.state_name]
        .filter(Boolean)
        .join(", ")
    : ""

  const isDemo = !seller || seller.is_demo_configuration || seller.gst_rates_sample
  const title = invoice.customer_gstin ? "TAX INVOICE" : "TAX INVOICE (B2C)"

  return {
    title,
    number: invoice.invoice_number ?? "DRAFT",
    status: invoice.status,
    isDemo,
    intra,
    invoice,
    seller,
    sellerAddress,
    buyer: {
      name: invoice.customer_name,
      gstin: invoice.customer_gstin,
      phone: invoice.customer_phone,
      billing: invoice.billing_address,
      shipping: invoice.shipping_address,
    },
    placeOfSupply: `${invoice.place_of_supply} · ${stateName.get(invoice.place_of_supply) ?? ""}`,
    lines,
    rateSummary: [...byRate.values()].sort((a, b) => a.rate - b.rate),
    amountInWords: amountInWords(invoice.grand_total),
    balanceDue: dec(invoice.grand_total).minus(invoice.amount_paid),
  }
}
export type InvoiceModel = ReturnType<typeof buildInvoiceModel>
