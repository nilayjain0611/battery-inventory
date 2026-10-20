import { createClient } from "@/lib/supabase/server"
import { unwrap } from "./query"

export interface DashboardMetrics {
  today: string
  sales_today: number
  invoices_today: number
  sales_month: number
  invoices_month: number
  total_products: number
  products_by_type: Partial<Record<"raw_material" | "manufactured" | "trading", number>>
  stock_quantity: number
  finished_goods_quantity: number
  inventory_value: number
  low_stock_count: number
  receivables: number
  overdue_receivables: number
  payables: number
  production_month_orders: number
  production_month_quantity: number
  sales_trend: { date: string; total: number }[]
  recent_sales: {
    id: string
    invoice_number: string
    customer_name: string
    invoice_date: string
    grand_total: number
    payment_status: string
    sale_type: string
  }[]
  recent_movements: {
    id: string
    sku: string
    product_name: string
    movement_type: string
    quantity: number
    reference: string | null
    created_at: string
  }[]
  low_stock: { id: string; sku: string; name: string; stock_type: string; quantity: number; reorder_level: number; uom: string }[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient()
  const data = unwrap(await supabase.rpc("dashboard_metrics"), "Dashboard")
  return data as unknown as DashboardMetrics
}
