import { cn } from "cn"

import type { DocumentTotals } from "@/lib/domain/tax"
import { formatINR } from "@/lib/domain/money"

/** Tax summary panel used by the invoice builder, purchase form and document views. */
export function TaxSummary({
  totals,
  supplyType,
  className,
  note,
}: {
  totals: Pick<DocumentTotals, "subtotal" | "discount" | "cgst" | "sgst" | "igst" | "tax" | "roundOff" | "grandTotal">
  supplyType: "intra_state" | "inter_state"
  className?: string
  note?: string
}) {
  const rows: [string, string, boolean?][] = [
    ["Taxable value", formatINR(totals.subtotal.toString())],
    ...(Number(totals.discount) > 0 ? [["Discounts given", `− ${formatINR(totals.discount.toString())}`] as [string, string]] : []),
    ...(supplyType === "intra_state"
      ? ([
          ["CGST", formatINR(totals.cgst.toString())],
          ["SGST", formatINR(totals.sgst.toString())],
        ] as [string, string][])
      : ([["IGST", formatINR(totals.igst.toString())]] as [string, string][])),
    ["Total tax", formatINR(totals.tax.toString()), true],
    ...(Number(totals.roundOff) !== 0 ? [["Round off", formatINR(totals.roundOff.toString())] as [string, string]] : []),
  ]
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <dl className="space-y-1.5 p-4 text-sm">
        {rows.map(([label, value, strong]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className={cn("text-muted-foreground", strong && "font-medium text-foreground")}>{label}</dt>
            <dd className={cn("tabular", strong && "font-medium")}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between rounded-b-lg border-t bg-muted/50 px-4 py-3">
        <span className="text-sm font-semibold">Grand total</span>
        <span className="tabular text-lg font-semibold">{formatINR(totals.grandTotal.toString())}</span>
      </div>
      {note ? <p className="px-4 pb-3 text-[11px] text-muted-foreground">{note}</p> : null}
    </div>
  )
}
