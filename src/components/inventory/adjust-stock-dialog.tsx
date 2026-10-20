"use client"

import { useState, useTransition } from "react"
import { SlidersHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, FormError } from "@/components/ui/field"
import { Input, Select, Textarea } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { adjustStock } from "@/lib/actions/inventory"
import { formatQty } from "@/lib/domain/money"

interface Option {
  id: string
  label: string
  uom: string
  quantity: number
  avgCost: number
}

export function AdjustStockDialog({
  products,
  today,
  defaultProductId,
  triggerLabel = "Adjust stock",
}: {
  products: Option[]
  today: string
  defaultProductId?: string
  triggerLabel?: string
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const idem = useIdempotencyKey()
  const [productId, setProductId] = useState(defaultProductId ?? "")
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease")
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [reason, setReason] = useState("")
  const [date, setDate] = useState(today)
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const product = products.find((p) => p.id === productId)

  function reset() {
    idem.reset()
    setQuantity("")
    setUnitCost("")
    setReason("")
    setErrors({})
    setFormError(null)
  }

  function submit() {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const res = await adjustStock({
        idempotency_key: idem.get(),
        product_id: productId,
        direction,
        quantity,
        unit_cost: direction === "increase" && unitCost ? unitCost : undefined,
        reason,
        adjustment_date: date,
      })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        setFormError(res.error)
        return
      }
      toast.success(res.message ?? "Adjustment recorded")
      setOpen(false)
      reset()
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <SlidersHorizontalIcon /> {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Stock adjustment"
        description="Corrects stock after a physical count, damage or loss. Recorded as a ledger movement with your name and reason; existing movements are never edited."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !productId}>
              {pending ? "Recording…" : "Record adjustment"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product" htmlFor="adj-product" required error={errors.product_id} className="sm:col-span-2">
            <Select id="adj-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Choose a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
            {product ? (
              <p className="text-xs text-muted-foreground">Current stock: {formatQty(product.quantity, product.uom)}</p>
            ) : null}
          </Field>
          <Field label="Direction" htmlFor="adj-dir">
            <Select id="adj-dir" value={direction} onChange={(e) => setDirection(e.target.value as "increase" | "decrease")}>
              <option value="decrease">Decrease (damage, loss, count shortfall)</option>
              <option value="increase">Increase (count surplus, found stock)</option>
            </Select>
          </Field>
          <Field label="Quantity" htmlFor="adj-qty" required error={errors.quantity}>
            <Input id="adj-qty" type="number" min="0" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          {direction === "increase" ? (
            <Field label="Unit cost (₹)" htmlFor="adj-cost" error={errors.unit_cost} hint={product ? `Blank = current average ₹${product.avgCost}` : undefined}>
              <Input id="adj-cost" type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </Field>
          ) : null}
          <Field label="Date" htmlFor="adj-date" error={errors.adjustment_date}>
            <Input id="adj-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Reason" htmlFor="adj-reason" required error={errors.reason} className="sm:col-span-2">
            <Textarea id="adj-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Monthly count on 20 Oct: 2 containers cracked" />
          </Field>
        </div>
        <div className="mt-4">
          <FormError message={formError} />
        </div>
      </Dialog>
    </>
  )
}
