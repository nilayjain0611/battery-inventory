"use client"

import { useState, useTransition } from "react"
import { CircleCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/dialog"
import { Field, FormError } from "@/components/ui/field"
import { Input, Textarea } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { completeProductionOrder } from "@/lib/actions/manufacturing"
import { dec, formatINR, formatQty } from "@/lib/domain/money"
import { cn } from "cn"

interface Material {
  product_id: string
  sku: string
  name: string
  uom: string
  expected: number
  available: number
  avg_cost: number
}

export function CompleteProductionForm({
  orderId,
  orderNumber,
  productName,
  planned,
  materials,
  overheadEstimate,
}: {
  orderId: string
  orderNumber: string
  productName: string
  planned: number
  materials: Material[]
  overheadEstimate: number | null
}) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)
  const [produced, setProduced] = useState(String(planned))
  const [actual, setActual] = useState<Record<string, string>>(
    Object.fromEntries(materials.map((m) => [m.product_id, String(m.expected)])),
  )
  const [wastage, setWastage] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const rows = materials.map((m) => {
    const used = dec(actual[m.product_id] || 0)
    return { ...m, used, variance: used.minus(m.expected), short: used.gt(m.available), cost: used.times(m.avg_cost) }
  })
  const materialCost = rows.reduce((s, r) => s.plus(r.cost), dec(0))
  const producedQty = dec(produced || 0)
  const unitCost = producedQty.gt(0) ? materialCost.div(producedQty) : dec(0)
  const anyShort = rows.some((r) => r.short)

  function submit() {
    setFormError(null)
    startTransition(async () => {
      const res = await completeProductionOrder({
        id: orderId,
        produced_quantity: produced,
        materials: rows.map((r) => ({ product_id: r.product_id, actual_quantity: actual[r.product_id] || "0" })),
        wastage_notes: wastage,
      })
      setConfirm(false)
      if (!res.ok) {
        setFormError(res.error)
        toast.error("Production not completed", res.error)
        return
      }
      toast.success(res.message ?? "Production completed")
    })
  }

  return (
    <Card>
      <CardHeader
        title="Record actual production"
        description="Enter what was really produced and consumed. Completing posts the stock movements; it cannot be edited or completed twice."
      />
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Produced quantity (planned ${formatQty(planned)})`} htmlFor="produced" required>
            <Input id="produced" type="number" min="0" step="1" value={produced} onChange={(e) => setProduced(e.target.value)} />
          </Field>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Material</th>
                <th className="px-3 py-2 text-right font-medium">Expected</th>
                <th className="w-36 px-3 py-2 text-right font-medium">Actually used</th>
                <th className="px-3 py-2 text-right font-medium">Variance</th>
                <th className="px-3 py-2 text-right font-medium">Available</th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product_id} className="border-t">
                  <td className="px-3 py-2">
                    {r.name}
                    <p className="font-mono text-xs text-muted-foreground">{r.sku}</p>
                  </td>
                  <td className="tabular px-3 py-2 text-right">{formatQty(r.expected, r.uom)}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      className="text-right"
                      aria-label={`Used ${r.name}`}
                      value={actual[r.product_id] ?? ""}
                      onChange={(e) => setActual((a) => ({ ...a, [r.product_id]: e.target.value }))}
                      aria-invalid={r.short}
                    />
                  </td>
                  <td className={cn("tabular px-3 py-2 text-right", r.variance.gt(0) ? "text-destructive" : r.variance.lt(0) ? "text-success" : "text-muted-foreground")}>
                    {r.variance.gt(0) ? "+" : ""}
                    {formatQty(r.variance)}
                  </td>
                  <td className={cn("tabular px-3 py-2 text-right", r.short ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    {formatQty(r.available, r.uom)}
                  </td>
                  <td className="tabular px-3 py-2 text-right">{formatINR(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Field label="Wastage / adjustment notes" htmlFor="wastage">
            <Textarea id="wastage" rows={3} value={wastage} onChange={(e) => setWastage(e.target.value)} placeholder="e.g. 1 unit failed formation; extra lead on rework" />
          </Field>
          <dl className="space-y-1.5 rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Material cost</dt>
              <dd className="tabular font-medium">{formatINR(materialCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Material cost per unit</dt>
              <dd className="tabular">{formatINR(unitCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Labour / overhead</dt>
              <dd className="tabular text-muted-foreground">
                {overheadEstimate !== null ? `${formatINR(overheadEstimate)} /unit (estimate)` : "Not configured"}
              </dd>
            </div>
            <p className="pt-1 text-[11px] text-muted-foreground">
              Estimate at current average cost. Stock is valued at material cost only; labour and overhead are shown for information.
            </p>
          </dl>
        </div>

        <FormError message={formError ?? (anyShort ? "Not enough stock for one or more materials. Receive a purchase or adjust stock first." : null)} />
        <div className="flex justify-end">
          <Button onClick={() => setConfirm(true)} disabled={pending || anyShort || producedQty.lte(0)} size="lg">
            <CircleCheckIcon /> Complete production
          </Button>
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={submit}
        pending={pending}
        title={`Complete ${orderNumber}?`}
        confirmLabel="Complete and post stock"
        description={`This consumes the materials above and adds ${formatQty(producedQty)} × ${productName} to stock. It cannot be undone or completed again.`}
      />
    </Card>
  )
}
