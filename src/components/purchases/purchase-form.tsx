"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition, type FormEvent } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"

import { ProductPicker, type PickerProduct } from "@/components/documents/product-picker"
import { TaxSummary } from "@/components/documents/tax-summary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FormError } from "@/components/ui/field"
import { Input, Select, Textarea } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { createPurchase } from "@/lib/actions/purchases"
import { formatINR } from "@/lib/domain/money"
import { calcLine, sumLines, supplyTypeFor } from "@/lib/domain/tax"
import { PAYMENT_METHOD_LABELS } from "@/lib/format"

interface Line {
  key: number
  product_id: string
  quantity: string
  unit_price: string
  discount_amount: string
}

export interface PurchaseProduct extends PickerProduct {
  purchase_price: number
  gst_rate: number
  hsn_code: string | null
}

let lineSeq = 1
const newLine = (): Line => ({ key: lineSeq++, product_id: "", quantity: "", unit_price: "", discount_amount: "" })

export function PurchaseForm({
  suppliers,
  products,
  companyState,
  today,
  defaultSupplierId,
}: {
  suppliers: { id: string; name: string; state_code: string; gstin: string | null }[]
  products: PurchaseProduct[]
  companyState: string
  today: string
  defaultSupplierId?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const idem = useIdempotencyKey()
  const [pending, startTransition] = useTransition()
  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? "")
  const [date, setDate] = useState(today)
  const [invoiceNo, setInvoiceNo] = useState("")
  const [onCredit, setOnCredit] = useState(true)
  const [method, setMethod] = useState("bank_transfer")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<Line[]>([newLine()])
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})

  const supplier = suppliers.find((s) => s.id === supplierId)
  const supply = supplyTypeFor(companyState, supplier?.state_code ?? companyState)
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const computed = lines.map((l) => {
    const p = byId.get(l.product_id)
    if (!p || !l.quantity) return null
    return calcLine(
      { quantity: l.quantity, unitPrice: l.unit_price || 0, discountType: "amount", discountValue: l.discount_amount || 0, gstRate: p.gst_rate },
      false,
      supply,
    )
  })
  const totals = sumLines(computed.filter((c): c is NonNullable<typeof c> => !!c && !c.error), false)

  function update(key: number, patch: Partial<Line>) {
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setErrors({})
    const filled = lines.filter((l) => l.product_id)
    startTransition(async () => {
      const res = await createPurchase({
        idempotency_key: idem.get(),
        supplier_id: supplierId,
        supplier_invoice_number: invoiceNo,
        purchase_date: date,
        on_credit: onCredit,
        payment_method: onCredit ? undefined : (method as "cash"),
        payment_reference: onCredit ? undefined : reference,
        notes,
        lines: filled.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_amount: l.discount_amount || 0,
        })),
      })
      if (!res.ok) {
        setFormError(res.error)
        setErrors(res.fieldErrors ?? {})
        toast.error("Purchase not recorded", res.error)
        return
      }
      idem.reset()
      toast.success(res.message ?? "Purchase recorded")
      router.push(`/purchases/${res.data.id}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Card>
        <CardHeader title="Supplier bill" description="Confirming records the bill and receives the goods into stock in one step." />
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Supplier" htmlFor="supplier" required error={errors.supplier_id} className="lg:col-span-2">
            <Select id="supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Choose supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {supplier ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{supplier.gstin ?? "Unregistered"}</span>
                <Badge tone={supply === "intra_state" ? "neutral" : "info"}>
                  {supply === "intra_state" ? "Intra-state · CGST + SGST" : "Inter-state · IGST"}
                </Badge>
              </p>
            ) : null}
          </Field>
          <Field label="Supplier invoice no." htmlFor="sinv" error={errors.supplier_invoice_number}>
            <Input id="sinv" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </Field>
          <Field label="Bill / receipt date" htmlFor="pdate" required error={errors.purchase_date}>
            <Input id="pdate" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Payment" htmlFor="credit">
            <Select id="credit" value={onCredit ? "credit" : "paid"} onChange={(e) => setOnCredit(e.target.value === "credit")}>
              <option value="credit">On credit (adds to payables)</option>
              <option value="paid">Paid now in full</option>
            </Select>
          </Field>
          {!onCredit ? (
            <>
              <Field label="Paid by" htmlFor="method">
                <Select id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment reference" htmlFor="ref">
                <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
              </Field>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Items received" description="Prices exclude GST. Stock is valued at the net (taxable) cost." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Product</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Qty</th>
                <th className="w-32 px-3 py-2 text-right font-medium">Unit price ₹</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Discount ₹</th>
                <th className="w-20 px-3 py-2 text-right font-medium">GST</th>
                <th className="w-32 px-3 py-2 text-right font-medium">Line total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const p = byId.get(l.product_id)
                const c = computed[i]
                return (
                  <tr key={l.key} className="border-b align-top">
                    <td className="px-3 py-2">
                      <ProductPicker
                        products={products}
                        value={l.product_id}
                        exclude={lines.map((x) => x.product_id)}
                        onChange={(pid) => {
                          const prod = byId.get(pid)
                          update(l.key, { product_id: pid, unit_price: l.unit_price || String(prod?.purchase_price ?? "") })
                        }}
                      />
                      {c?.error ? <p className="mt-1 text-xs text-destructive">{c.error}</p> : null}
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" step="0.001" className="text-right" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} aria-label="Quantity" />
                      {p ? <p className="mt-1 text-right text-[11px] text-muted-foreground">{p.uom}</p> : null}
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" step="0.01" className="text-right" value={l.unit_price} onChange={(e) => update(l.key, { unit_price: e.target.value })} aria-label="Unit price" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" step="0.01" className="text-right" value={l.discount_amount} onChange={(e) => update(l.key, { discount_amount: e.target.value })} aria-label="Discount" />
                    </td>
                    <td className="tabular px-3 py-2 pt-4 text-right text-muted-foreground">{p ? `${p.gst_rate}%` : "—"}</td>
                    <td className="tabular px-3 py-2 pt-4 text-right font-medium">{c && !c.error ? formatINR(c.total.toString()) : "—"}</td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove line"
                        disabled={lines.length === 1}
                        onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}
                      >
                        <Trash2Icon />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((all) => [...all, newLine()])}>
            <PlusIcon /> Add line
          </Button>
          {errors.lines ? <p className="mt-2 text-xs text-destructive">{errors.lines[0]}</p> : null}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <TaxSummary totals={totals} supplyType={supply} note="Preview. Final figures are calculated by the server when you confirm." />
      </div>

      <FormError message={formError} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending || !supplierId}>
          {pending ? "Recording…" : "Confirm receipt"}
        </Button>
      </div>
    </form>
  )
}
