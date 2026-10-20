import { Badge, type BadgeTone } from "@/components/ui/badge"
import { MOVEMENT_LABELS, STOCK_TYPE_LABELS } from "@/lib/format"

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  posted: { label: "Posted", tone: "info" },
  cancelled: { label: "Cancelled", tone: "danger" },
  completed: { label: "Completed", tone: "success" },
  paid: { label: "Paid", tone: "success" },
  partial: { label: "Part-paid", tone: "warning" },
  unpaid: { label: "Unpaid", tone: "neutral" },
  overdue: { label: "Overdue", tone: "danger" },
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  low: { label: "Low stock", tone: "danger" },
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = STATUS[status ?? ""] ?? { label: status ?? "—", tone: "neutral" as const }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

const STOCK_TONE: Record<string, BadgeTone> = { raw_material: "neutral", manufactured: "brand", trading: "info" }

export function StockTypeBadge({ type }: { type: string | null | undefined }) {
  if (!type) return null
  return <Badge tone={STOCK_TONE[type] ?? "neutral"}>{STOCK_TYPE_LABELS[type as keyof typeof STOCK_TYPE_LABELS] ?? type}</Badge>
}

export function MovementBadge({ type }: { type: string | null | undefined }) {
  if (!type) return null
  const inbound = ["opening_balance", "purchase_receipt", "production_output", "sales_return", "sale_cancellation"].includes(type)
  return <Badge tone={type === "stock_adjustment" ? "warning" : inbound ? "success" : "neutral"}>{MOVEMENT_LABELS[type] ?? type}</Badge>
}
