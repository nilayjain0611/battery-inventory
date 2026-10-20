"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { PlusIcon, SendIcon, SaveIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { ProductPicker, type PickerProduct } from "@/components/documents/product-picker"
import { TaxSummary } from "@/components/documents/tax-summary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/dialog"
import { Field, FormError } from "@/components/ui/field"
import { Input, Select, Textarea } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { saveInvoice } from "@/lib/actions/sales"
import { addDays } from "@/lib/format"
import { dec, formatINR, formatQty } from "@/lib/domain/money"
import { calcLine, sumLines, supplyTypeFor, type DiscountType } from "@/lib/domain/tax"

export interface BuilderCustomer {
  id: string
  name: string
  customer_type: "retail" | "wholesale"
  is_walk_in: boolean
  state_code: string
  gstin: string | null
  billing_address: string | null
  shipping_address: string | null
  credit_days: number
  outstanding: number
}

export interface BuilderProduct extends PickerProduct {
  retail_price: number
  wholesale_price: number
  gst_rate: number
  hsn_code: string | null
}

export interface BuilderLine {
  key: number
  product_id: string
  quantity: string
  unit_price: string
  discount_type: DiscountType | ""
  discount_value: string
}

export interface BuilderInitial {
  customer_id: string
  sale_type: "retail" | "wholesale"
  invoice_date: string
  due_date: string
  place_of_supply: string
  prices_include_tax: boolean
  payment_terms: string
  billing_address: string
  shipping_address: string
  notes: string
  lines: Omit<BuilderLine, "key">[]
}

let seq = 1
const blankLine = (): BuilderLine => ({ key: seq++, product_id: "", quantity: "1", unit_price: "", discount_type: "", discount_value: "" })

export function InvoiceBuilder({
  invoiceId,
  initial,
  customers,
  products,
  states,
  companyState,
  today,
}: {
  invoiceId?: string
  initial: BuilderInitial
  customers: BuilderCustomer[]
  products: BuilderProduct[]
  states: { code: string; name: string }[]
  companyState: string
  today: string
}) {
  const router = useRouter()
  const toast = useToast()
  const idem = useIdempotencyKey()
  const [pending, startTransition] = useTransition()
  const [confirmPost, setConfirmPost] = useState(false)
  const [h, setH] = useState(() => ({ ...initial }))
  const [lines, setLines] = useState<BuilderLine[]>(() =>
    initial.lines.length ? initial.lines.map((l) => ({ ...l, key: seq++ })) : [blankLine()],
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})

  const customer = customers.find((c) => c.id === h.customer_id)
  const pos = customer?.is_walk_in ? companyState : h.place_of_supply || companyState
  const supply = supplyTypeFor(companyState, pos)
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const computed = lines.map((l) => {
    const p = productById.get(l.product_id)
    if (!p || !l.quantity) return null
    return calcLine(
      {
        quantity: l.quantity,
        unitPrice: l.unit_price || 0,
        discountType: l.discount_type || null,
        discountValue: l.discount_value || 0,
        gstRate: p.gst_rate,
      },
      h.prices_include_tax,
      supply,
    )
  })
  const valid = computed.filter((c): c is NonNullable<typeof c> => !!c && !c.error)
  const totals = sumLines(valid, true)
  const hasLineErrors = computed.some((c) => c?.error)

  function setHeader<K extends keyof BuilderInitial>(k: K, v: BuilderInitial[K]) {
    setH((prev) => ({ ...prev, [k]: v }))
  }

  function defaultPrice(p: BuilderProduct, saleType: "retail" | "wholesale", inclusive: boolean): string {
    // Retail price is stored GST-inclusive, wholesale GST-exclusive; convert if the
    // chosen pricing basis differs.
    const base = saleType === "retail" ? p.retail_price : p.wholesale_price
    const baseInclusive = saleType === "retail"
    if (!base) return ""
    if (baseInclusive === inclusive) return String(base)
    const factor = dec(100).plus(p.gst_rate).div(100)
    return (inclusive ? dec(base).times(factor) : dec(base).div(factor)).toDecimalPlaces(2).toString()
  }

  function chooseCustomer(cid: string) {
    const c = customers.find((x) => x.id === cid)
    if (!c) {
      setHeader("customer_id", cid)
      return
    }
    const saleType = c.is_walk_in ? "retail" : c.customer_type
    const inclusive = saleType === "retail"
    setH((prev) => ({
      ...prev,
      customer_id: cid,
      sale_type: saleType,
      prices_include_tax: inclusive,
      place_of_supply: c.is_walk_in ? companyState : c.state_code,
      billing_address: c.billing_address ?? "",
      shipping_address: c.shipping_address ?? "",
      due_date: c.credit_days ? addDays(prev.invoice_date, c.credit_days) : "",
      payment_terms: c.credit_days ? `Net ${c.credit_days} days` : "Due on receipt",
    }))
    // Re-price lines for the new customer type.
    setLines((all) =>
      all.map((l) => {
        const p = productById.get(l.product_id)
        return p ? { ...l, unit_price: defaultPrice(p, saleType, inclusive) } : l
      }),
    )
  }

  function changeSaleType(saleType: "retail" | "wholesale") {
    const inclusive = saleType === "retail"
    setH((prev) => ({ ...prev, sale_type: saleType, prices_include_tax: inclusive }))
    setLines((all) =>
      all.map((l) => {
        const p = productById.get(l.product_id)
        return p ? { ...l, unit_price: defaultPrice(p, saleType, inclusive) } : l
      }),
    )
  }

  function updateLine(key: number, patch: Partial<BuilderLine>) {
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function submit(post: boolean) {
    setFormError(null)
    setErrors({})
    startTransition(async () => {
      const res = await saveInvoice({
        id: invoiceId,
        post,
        values: {
          idempotency_key: idem.get(),
          customer_id: h.customer_id,
          sale_type: h.sale_type,
          invoice_date: h.invoice_date,
          due_date: h.due_date,
          place_of_supply: pos,
          prices_include_tax: h.prices_include_tax,
          payment_terms: h.payment_terms,
          billing_address: h.billing_address,
          shipping_address: h.shipping_address,
          notes: h.notes,
          lines: lines
            .filter((l) => l.product_id)
            .map((l) => ({
              product_id: l.product_id,
              quantity: l.quantity,
              unit_price: l.unit_price,
              discount_type: l.discount_type || null,
              discount_value: l.discount_value || 0,
            })),
        },
      })
      setConfirmPost(false)
      if (!res.ok) {
        setFormError(res.error)
        setErrors(res.fieldErrors ?? {})
        toast.error(post ? "Invoice not posted" : "Draft not saved", res.error)
        return
      }
      idem.reset()
      toast.success(res.message ?? "Saved")
      router.push(`/sales/${res.data.id}`)
    })
  }

  const stockWarnings = lines
    .map((l) => {
      const p = productById.get(l.product_id)
      return p && Number(l.quantity) > p.quantity ? `${p.sku}: only ${formatQty(p.quantity, p.uom)} in stock` : null
    })
    .filter(Boolean)

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Bill to" description="Customer, place of supply and pricing basis decide the tax treatment." />
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Customer" htmlFor="customer" required error={errors.customer_id} className="lg:col-span-2">
            <Select id="customer" value={h.customer_id} onChange={(e) => chooseCustomer(e.target.value)}>
              <option value="">Choose customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_walk_in ? " (counter sale)" : c.customer_type === "wholesale" ? " · wholesale" : ""}
                </option>
              ))}
            </Select>
            {customer ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{customer.gstin ?? "Unregistered (B2C)"}</span>
                {customer.outstanding > 0 ? <Badge tone="warning">Owes {formatINR(customer.outstanding)}</Badge> : null}
              </div>
            ) : null}
          </Field>
          <Field label="Sale type" htmlFor="saletype">
            <Select
              id="saletype"
              value={h.sale_type}
              disabled={customer?.is_walk_in}
              onChange={(e) => changeSaleType(e.target.value as "retail" | "wholesale")}
            >
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </Select>
          </Field>
          <Field label="Prices entered" htmlFor="inclusive" hint="Retail shelf prices usually include GST">
            <Select
              id="inclusive"
              value={h.prices_include_tax ? "incl" : "excl"}
              onChange={(e) => setHeader("prices_include_tax", e.target.value === "incl")}
            >
              <option value="incl">Including GST</option>
              <option value="excl">Excluding GST</option>
            </Select>
          </Field>
          <Field label="Invoice date" htmlFor="idate" required error={errors.invoice_date}>
            <Input
              id="idate"
              type="date"
              max={today}
              value={h.invoice_date}
              onChange={(e) => {
                const d = e.target.value
                setH((prev) => ({ ...prev, invoice_date: d, due_date: customer?.credit_days ? addDays(d, customer.credit_days) : prev.due_date }))
              }}
            />
          </Field>
          <Field label="Due date" htmlFor="ddate" error={errors.due_date}>
            <Input id="ddate" type="date" min={h.invoice_date} value={h.due_date} onChange={(e) => setHeader("due_date", e.target.value)} />
          </Field>
          <Field label="Place of supply" htmlFor="pos" error={errors.place_of_supply} hint={customer?.is_walk_in ? "Counter sale: seller's state" : undefined}>
            <Select id="pos" value={pos} disabled={customer?.is_walk_in} onChange={(e) => setHeader("place_of_supply", e.target.value)}>
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} · {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tax treatment" htmlFor="supply">
            <div className="flex h-9 items-center">
              <Badge tone={supply === "intra_state" ? "neutral" : "info"}>
                {supply === "intra_state" ? "Intra-state · CGST + SGST" : "Inter-state · IGST"}
              </Badge>
            </div>
          </Field>
          {!customer?.is_walk_in ? (
            <>
              <Field label="Billing address" htmlFor="bill" className="sm:col-span-2">
                <Textarea id="bill" rows={2} value={h.billing_address} onChange={(e) => setHeader("billing_address", e.target.value)} />
              </Field>
              <Field label="Shipping address" htmlFor="ship" hint="Blank = same as billing" className="sm:col-span-2">
                <Textarea id="ship" rows={2} value={h.shipping_address} onChange={(e) => setHeader("shipping_address", e.target.value)} />
              </Field>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Items"
          description={h.prices_include_tax ? "Unit prices include GST; tax is extracted." : "Unit prices exclude GST; tax is added."}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Product</th>
                <th className="w-24 px-2 py-2 text-right font-medium">Qty</th>
                <th className="w-32 px-2 py-2 text-right font-medium">Unit price ₹</th>
                <th className="w-44 px-2 py-2 text-left font-medium">Discount</th>
                <th className="w-28 px-2 py-2 text-right font-medium">Taxable</th>
                <th className="w-24 px-2 py-2 text-right font-medium">GST</th>
                <th className="w-32 px-2 py-2 text-right font-medium">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const p = productById.get(l.product_id)
                const c = computed[i]
                const short = p ? Number(l.quantity) > p.quantity : false
                return (
                  <tr key={l.key} className="border-b align-top">
                    <td className="px-3 py-2">
                      <ProductPicker
                        products={products}
                        value={l.product_id}
                        exclude={lines.map((x) => x.product_id)}
                        onChange={(pid) => {
                          const prod = productById.get(pid)
                          updateLine(l.key, { product_id: pid, unit_price: prod ? defaultPrice(prod, h.sale_type, h.prices_include_tax) : "" })
                        }}
                      />
                      {p ? (
                        <p className={cn("mt-1 text-[11px]", short ? "text-destructive" : "text-muted-foreground")}>
                          HSN {p.hsn_code ?? "—"} · in stock {formatQty(p.quantity, p.uom)}
                        </p>
                      ) : null}
                      {c?.error ? <p className="mt-1 text-xs text-destructive">{c.error}</p> : null}
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="0" step="1" className="text-right" aria-label="Quantity" value={l.quantity} aria-invalid={short} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="0" step="0.01" className="text-right" aria-label="Unit price" value={l.unit_price} onChange={(e) => updateLine(l.key, { unit_price: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Select
                          aria-label="Discount type"
                          className="w-16 px-1.5"
                          value={l.discount_type}
                          onChange={(e) => updateLine(l.key, { discount_type: e.target.value as DiscountType | "", discount_value: e.target.value ? l.discount_value : "" })}
                        >
                          <option value="">—</option>
                          <option value="percent">%</option>
                          <option value="amount">₹</option>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="text-right"
                          aria-label="Discount value"
                          disabled={!l.discount_type}
                          value={l.discount_value}
                          onChange={(e) => updateLine(l.key, { discount_value: e.target.value })}
                        />
                      </div>
                    </td>
                    <td className="tabular px-2 py-2 pt-4 text-right">{c && !c.error ? formatINR(c.taxable.toString()) : "—"}</td>
                    <td className="tabular px-2 py-2 pt-4 text-right text-muted-foreground">
                      {p ? `${p.gst_rate}%` : "—"}
                      {c && !c.error ? <span className="block text-[11px]">{formatINR(c.cgst.plus(c.sgst).plus(c.igst).toString())}</span> : null}
                    </td>
                    <td className="tabular px-2 py-2 pt-4 text-right font-medium">{c && !c.error ? formatINR(c.total.toString()) : "—"}</td>
                    <td className="px-1 py-2">
                      <Button
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
        <div className="flex flex-wrap items-center gap-3 p-3">
          <Button variant="outline" size="sm" onClick={() => setLines((all) => [...all, blankLine()])}>
            <PlusIcon /> Add line
          </Button>
          {errors.lines ? <p className="text-xs text-destructive">{errors.lines[0]}</p> : null}
          {stockWarnings.length ? (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <TriangleAlertIcon className="size-3.5" /> {stockWarnings.join("; ")}. Posting will be refused.
            </p>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Field label="Payment terms" htmlFor="terms">
            <Input id="terms" value={h.payment_terms} onChange={(e) => setHeader("payment_terms", e.target.value)} placeholder="e.g. Net 30 days" />
          </Field>
          <Field label="Notes (printed on invoice)" htmlFor="notes">
            <Textarea id="notes" rows={3} value={h.notes} onChange={(e) => setHeader("notes", e.target.value)} />
          </Field>
        </div>
        <TaxSummary totals={totals} supplyType={supply} note="Live preview. The server recalculates every figure from the GST configuration when you save or post." />
      </div>

      <FormError message={formError} />
      <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <Button variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => submit(false)} disabled={pending || !h.customer_id || hasLineErrors}>
          <SaveIcon /> Save draft
        </Button>
        <Button onClick={() => setConfirmPost(true)} disabled={pending || !h.customer_id || hasLineErrors || valid.length === 0}>
          <SendIcon /> Post invoice
        </Button>
      </div>

      <ConfirmDialog
        open={confirmPost}
        onClose={() => setConfirmPost(false)}
        onConfirm={() => submit(true)}
        pending={pending}
        title="Post this invoice?"
        confirmLabel="Post invoice"
        description={
          <>
            Posting allocates the invoice number, removes the items from stock and freezes the invoice. Total{" "}
            <strong className="tabular text-foreground">{formatINR(totals.grandTotal.toString())}</strong>. Posted invoices can only be
            reversed by cancellation.
          </>
        }
      />
    </div>
  )
}
