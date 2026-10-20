const TZ = "Asia/Kolkata"

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
const dateFmtIST = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ })
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
})

/** Date-only values ("2026-10-20") are calendar dates and are not shifted between zones. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const d = new Date(dateOnly ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(d.getTime())) return "—"
  return dateOnly ? dateFmt.format(d) : dateFmtIST.format(d)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d)
}

/** Today's calendar date in India (YYYY-MM-DD). Call only at request time. */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date())
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function firstOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 8)}01`
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>

export function param(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return v && v.trim() ? v.trim() : undefined
}

export const STOCK_TYPE_LABELS = {
  raw_material: "Raw material",
  manufactured: "Own brand",
  trading: "Third-party",
} as const

export const MOVEMENT_LABELS: Record<string, string> = {
  opening_balance: "Opening balance",
  purchase_receipt: "Purchase receipt",
  sale: "Sale",
  production_consumption: "Production consumption",
  production_output: "Production output",
  sales_return: "Sales return",
  purchase_return: "Purchase return",
  stock_adjustment: "Stock adjustment",
  sale_cancellation: "Sale cancelled",
  purchase_cancellation: "Purchase cancelled",
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
}

/** Link to the document that caused a stock movement. */
export function sourceHref(sourceType: string | null, sourceId: string | null): string | null {
  if (!sourceType || !sourceId) return null
  switch (sourceType) {
    case "purchase":
      return `/purchases/${sourceId}`
    case "sales_invoice":
      return `/sales/${sourceId}`
    case "production_order":
      return `/manufacturing/${sourceId}`
    case "opening":
      return `/inventory/products/${sourceId}`
    default:
      return null
  }
}
