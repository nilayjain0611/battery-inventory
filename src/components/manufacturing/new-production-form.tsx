"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent } from "react"
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FormError } from "@/components/ui/field"
import { Input, Select, Textarea } from "@/components/ui/input"
import { TBody, TD, TDNum, TH, THead, TR, Table } from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { createProductionOrder } from "@/lib/actions/manufacturing"
import type { BomWithLines } from "@/lib/data/manufacturing"
import { dec, formatINR, formatQty } from "@/lib/domain/money"

export function NewProductionForm({ boms, today, defaultBomId }: { boms: BomWithLines[]; today: string; defaultBomId?: string }) {
  const router = useRouter()
  const toast = useToast()
  const idem = useIdempotencyKey()
  const [pending, startTransition] = useTransition()
  const [bomId, setBomId] = useState(defaultBomId ?? boms[0]?.id ?? "")
  const [planned, setPlanned] = useState("10")
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState("")
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const bom = boms.find((b) => b.id === bomId)
  const qty = dec(planned || 0)
  const requirements =
    bom?.lines.map((l) => {
      const need = dec(l.quantity).times(qty).div(dec(bom.output_quantity)).toDecimalPlaces(3)
      return { ...l, need, short: need.gt(l.available), cost: need.times(l.avg_cost) }
    }) ?? []
  const estCost = requirements.reduce((s, r) => s.plus(r.cost), dec(0))
  const anyShort = requirements.some((r) => r.short)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const res = await createProductionOrder({
        idempotency_key: idem.get(),
        bom_id: bomId,
        planned_quantity: planned,
        production_date: date,
        notes,
      })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        setFormError(res.error)
        return
      }
      idem.reset()
      toast.success(res.message ?? "Production order created")
      router.push(`/manufacturing/${res.data.id}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Card>
        <CardHeader title="What to produce" description="A draft order reserves nothing. Stock moves only when you complete it." />
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Bill of materials" htmlFor="bom" required error={errors.bom_id}>
            <Select id="bom" value={bomId} onChange={(e) => setBomId(e.target.value)}>
              {boms.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.product_sku} · {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Planned quantity" htmlFor="planned" required error={errors.planned_quantity}>
            <Input id="planned" type="number" min="1" step="1" value={planned} onChange={(e) => setPlanned(e.target.value)} />
          </Field>
          <Field label="Production date" htmlFor="pdate" required error={errors.production_date}>
            <Input id="pdate" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-3">
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {bom ? (
        <Card>
          <CardHeader
            title={`Material requirement for ${formatQty(qty)} × ${bom.product_name}`}
            description={
              anyShort ? (
                <span className="flex items-center gap-1 text-destructive">
                  <TriangleAlertIcon className="size-3.5" /> Some materials are short. You can plan now, but completion will be blocked until stock arrives.
                </span>
              ) : (
                <span className="flex items-center gap-1 text-success">
                  <CircleCheckIcon className="size-3.5" /> All materials available
                </span>
              )
            }
          />
          <Table>
            <THead>
              <TR>
                <TH>Component</TH>
                <TH className="text-right">Per unit</TH>
                <TH className="text-right">Required</TH>
                <TH className="text-right">Available</TH>
                <TH className="text-right">Est. cost</TH>
              </TR>
            </THead>
            <TBody>
              {requirements.map((r) => (
                <TR key={r.component_product_id}>
                  <TD>
                    {r.name}
                    <p className="font-mono text-xs text-muted-foreground">{r.sku}</p>
                  </TD>
                  <TDNum>{formatQty(dec(r.quantity).div(dec(bom.output_quantity)), r.uom)}</TDNum>
                  <TDNum className="font-medium">{formatQty(r.need, r.uom)}</TDNum>
                  <TDNum className={r.short ? "font-semibold text-destructive" : "text-muted-foreground"}>{formatQty(r.available, r.uom)}</TDNum>
                  <TDNum>{formatINR(r.cost)}</TDNum>
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="border-t px-4 py-3 text-sm">
            Estimated material cost <span className="tabular font-semibold">{formatINR(estCost)}</span>
            {qty.gt(0) ? <span className="text-muted-foreground"> · {formatINR(estCost.div(qty))} per unit at current average cost</span> : null}
          </p>
        </Card>
      ) : null}

      <FormError message={formError} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !bomId}>
          {pending ? "Creating…" : "Create production order"}
        </Button>
      </div>
    </form>
  )
}
