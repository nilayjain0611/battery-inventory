import { createClient } from "@/lib/supabase/server"
import { listProducts } from "./inventory"
import { listCustomers } from "./parties"
import { unwrap } from "./query"

export const REPORTS = {
  stock: "Current stock",
  "sales-date": "Sales by date",
  "sales-product": "Sales by product",
  receivables: "Customer balances",
  purchases: "Purchase summary",
  gst: "GST summary",
} as const
export type ReportKey = keyof typeof REPORTS

export interface ReportTable {
  columns: { key: string; label: string; numeric?: boolean; money?: boolean }[]
  rows: Record<string, string | number | null>[]
  totals?: Record<string, number>
  note?: string
}

function sum(rows: Record<string, string | number | null>[], keys: string[]) {
  const t: Record<string, number> = {}
  for (const k of keys) t[k] = Math.round(rows.reduce((s, r) => s + Number(r[k] ?? 0), 0) * 100) / 100
  return t
}

export async function runReport(key: ReportKey, from: string, to: string): Promise<ReportTable> {
  const supabase = await createClient()
  switch (key) {
    case "stock": {
      const products = await listProducts({ activeOnly: true })
      const rows = products.map((p) => ({
        sku: p.sku,
        name: p.name,
        type: p.stock_type,
        uom: p.uom,
        quantity: Number(p.quantity ?? 0),
        reorder: Number(p.reorder_level ?? 0),
        avg_cost: Number(p.avg_cost ?? 0),
        value: Number(p.stock_value ?? 0),
      }))
      return {
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product" },
          { key: "type", label: "Stock type" },
          { key: "uom", label: "UOM" },
          { key: "quantity", label: "On hand", numeric: true },
          { key: "reorder", label: "Reorder at", numeric: true },
          { key: "avg_cost", label: "Avg cost", money: true },
          { key: "value", label: "Value", money: true },
        ],
        rows,
        totals: sum(rows, ["value"]),
        note: "As of now; valued at weighted-average cost excluding GST.",
      }
    }
    case "sales-date": {
      const data = unwrap(await supabase.rpc("report_sales_by_date", { p_from: from, p_to: to }), "Sales by date")
      const rows = data.map((r) => ({ date: r.invoice_date, invoices: r.invoice_count, taxable: r.taxable, tax: r.tax, total: r.total }))
      return {
        columns: [
          { key: "date", label: "Date" },
          { key: "invoices", label: "Invoices", numeric: true },
          { key: "taxable", label: "Taxable", money: true },
          { key: "tax", label: "GST", money: true },
          { key: "total", label: "Total", money: true },
        ],
        rows,
        totals: sum(rows, ["invoices", "taxable", "tax", "total"]),
      }
    }
    case "sales-product": {
      const data = unwrap(await supabase.rpc("report_sales_by_product", { p_from: from, p_to: to }), "Sales by product")
      const rows = data.map((r) => ({
        sku: r.sku,
        name: r.product_name,
        type: r.stock_type,
        quantity: r.quantity,
        taxable: r.taxable,
        cost: r.cost,
        margin: r.margin,
        total: r.total,
      }))
      return {
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Product" },
          { key: "type", label: "Stock type" },
          { key: "quantity", label: "Qty sold", numeric: true },
          { key: "taxable", label: "Net sales", money: true },
          { key: "cost", label: "Cost of goods", money: true },
          { key: "margin", label: "Gross margin", money: true },
          { key: "total", label: "Incl. GST", money: true },
        ],
        rows,
        totals: sum(rows, ["quantity", "taxable", "cost", "margin", "total"]),
        note: "Cost of goods uses the weighted-average cost recorded when each invoice was posted.",
      }
    }
    case "receivables": {
      const customers = await listCustomers()
      const rows = customers
        .filter((c) => Number(c.total_invoiced ?? 0) > 0)
        .map((c) => ({
          name: c.name,
          gstin: c.gstin ?? "",
          invoices: c.invoice_count,
          invoiced: Number(c.total_invoiced ?? 0),
          paid: Number(c.total_paid ?? 0),
          outstanding: Number(c.outstanding ?? 0),
          overdue: Number(c.overdue ?? 0),
        }))
        .sort((a, b) => b.outstanding - a.outstanding)
      return {
        columns: [
          { key: "name", label: "Customer" },
          { key: "gstin", label: "GSTIN" },
          { key: "invoices", label: "Invoices", numeric: true },
          { key: "invoiced", label: "Invoiced", money: true },
          { key: "paid", label: "Received", money: true },
          { key: "outstanding", label: "Outstanding", money: true },
          { key: "overdue", label: "Overdue", money: true },
        ],
        rows,
        totals: sum(rows, ["invoiced", "paid", "outstanding", "overdue"]),
        note: "All-time balances (not limited to the date range).",
      }
    }
    case "purchases": {
      const data = unwrap(await supabase.rpc("report_purchase_summary", { p_from: from, p_to: to }), "Purchases")
      const rows = data.map((r) => ({
        supplier: r.supplier_name,
        bills: r.purchase_count,
        taxable: r.taxable,
        tax: r.tax,
        total: r.total,
        paid: r.paid,
        outstanding: r.outstanding,
      }))
      return {
        columns: [
          { key: "supplier", label: "Supplier" },
          { key: "bills", label: "Bills", numeric: true },
          { key: "taxable", label: "Taxable", money: true },
          { key: "tax", label: "GST", money: true },
          { key: "total", label: "Total", money: true },
          { key: "paid", label: "Paid", money: true },
          { key: "outstanding", label: "Payable", money: true },
        ],
        rows,
        totals: sum(rows, ["bills", "taxable", "tax", "total", "paid", "outstanding"]),
      }
    }
    case "gst": {
      const data = unwrap(await supabase.rpc("report_gst_summary", { p_from: from, p_to: to }), "GST summary")
      const rows = data.map((r) => ({
        direction: r.direction,
        supply: r.supply_type === "intra_state" ? "Intra-state" : "Inter-state",
        rate: `${r.gst_rate}%`,
        taxable: r.taxable,
        cgst: r.cgst,
        sgst: r.sgst,
        igst: r.igst,
        total_tax: r.total_tax,
      }))
      return {
        columns: [
          { key: "direction", label: "Direction" },
          { key: "supply", label: "Supply" },
          { key: "rate", label: "Rate" },
          { key: "taxable", label: "Taxable", money: true },
          { key: "cgst", label: "CGST", money: true },
          { key: "sgst", label: "SGST", money: true },
          { key: "igst", label: "IGST", money: true },
          { key: "total_tax", label: "Total tax", money: true },
        ],
        rows,
        note: "Basic summary from posted documents using SAMPLE tax configuration. Not a GSTR-1/3B return; verify with your accountant before filing.",
      }
    }
  }
}
