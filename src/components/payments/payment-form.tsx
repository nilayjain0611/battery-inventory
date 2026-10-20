"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent } from "react"
import { WalletIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FormError } from "@/components/ui/field"
import { Input, Select, Textarea } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { recordPayment } from "@/lib/actions/payments"
import { dec, formatINR } from "@/lib/domain/money"
import { PAYMENT_METHOD_LABELS, formatDate } from "@/lib/format"

export interface OpenDoc {
  id: string
  number: string
  partyId: string
  date: string
  due: string | null
  total: number
  balance: number
  extra?: string | null
}

export function PaymentForm({
  today,
  customers,
  suppliers,
  invoices,
  purchases,
  canReceive,
  canPay,
  initial,
}: {
  today: string
  customers: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  invoices: OpenDoc[]
  purchases: OpenDoc[]
  canReceive: boolean
  canPay: boolean
  initial: { direction: "receipt" | "payment"; partyId: string; allocations: Record<string, string> }
}) {
  const router = useRouter()
  const toast = useToast()
  const idem = useIdempotencyKey()
  const [pending, startTransition] = useTransition()
  const [direction, setDirection] = useState(initial.direction)
  const [partyId, setPartyId] = useState(initial.partyId)
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState("upi")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [alloc, setAlloc] = useState<Record<string, string>>(initial.allocations)
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})

  const parties = direction === "receipt" ? customers : suppliers
  const docs = (direction === "receipt" ? invoices : purchases).filter((d) => d.partyId === partyId)
  const total = docs.reduce((s, d) => s.plus(dec(alloc[d.id] || 0)), dec(0))
  const over = docs.find((d) => dec(alloc[d.id] || 0).gt(d.balance))
  const outstanding = docs.reduce((s, d) => s.plus(d.balance), dec(0))

  function switchDirection(d: "receipt" | "payment") {
    setDirection(d)
    setPartyId("")
    setAlloc({})
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setErrors({})
    startTransition(async () => {
      const res = await recordPayment({
        idempotency_key: idem.get(),
        direction,
        party_id: partyId,
        payment_date: date,
        method: method as "upi",
        reference,
        notes,
        allocations: docs
          .filter((d) => dec(alloc[d.id] || 0).gt(0))
          .map((d) => ({ document_id: d.id, amount: alloc[d.id] })),
      })
      if (!res.ok) {
        setFormError(res.error)
        setErrors(res.fieldErrors ?? {})
        toast.error("Payment not recorded", res.error)
        return
      }
      idem.reset()
      toast.success(res.message ?? "Payment recorded")
      router.push("/payments")
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Card>
        <CardHeader title="Payment" />
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Type" htmlFor="direction">
            <Select id="direction" value={direction} onChange={(e) => switchDirection(e.target.value as "receipt" | "payment")}>
              {canReceive ? <option value="receipt">Receipt from customer</option> : null}
              {canPay ? <option value="payment">Payment to supplier</option> : null}
            </Select>
          </Field>
          <Field label={direction === "receipt" ? "Customer" : "Supplier"} htmlFor="party" required error={errors.party_id}>
            <Select
              id="party"
              value={partyId}
              onChange={(e) => {
                setPartyId(e.target.value)
                setAlloc({})
              }}
            >
              <option value="">Choose…</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="pdate" required error={errors.payment_date}>
            <Input id="pdate" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Method" htmlFor="method">
            <Select id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" htmlFor="ref" error={errors.reference} hint="UTR, cheque or UPI ref.">
            <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title={direction === "receipt" ? "Allocate to invoices" : "Allocate to purchases"}
          description={partyId ? `Outstanding ${formatINR(outstanding)}. Enter a full or partial amount against each document.` : "Choose a party to see open documents."}
          action={
            docs.length ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAlloc(Object.fromEntries(docs.map((d) => [d.id, String(d.balance)])))}
              >
                Settle all
              </Button>
            ) : null
          }
        />
        {partyId && docs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing outstanding for this party.</p>
        ) : null}
        {docs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Document</th>
                  <th className="px-3 py-2 text-left font-medium">Due</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                  <th className="w-44 px-3 py-2 text-right font-medium">Allocate ₹</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const exceeds = dec(alloc[d.id] || 0).gt(d.balance)
                  return (
                    <tr key={d.id} className="border-b">
                      <td className="px-3 py-2">
                        <span className="font-medium">{d.number}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDate(d.date)}
                          {d.extra ? ` · ${d.extra}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(d.due)}</td>
                      <td className="tabular px-3 py-2 text-right">{formatINR(d.total)}</td>
                      <td className="tabular px-3 py-2 text-right font-medium">{formatINR(d.balance)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="text-right"
                            aria-label={`Allocate to ${d.number}`}
                            aria-invalid={exceeds}
                            value={alloc[d.id] ?? ""}
                            onChange={(e) => setAlloc((a) => ({ ...a, [d.id]: e.target.value }))}
                          />
                          <Button type="button" variant="ghost" size="xs" onClick={() => setAlloc((a) => ({ ...a, [d.id]: String(d.balance) }))}>
                            Full
                          </Button>
                        </div>
                        {exceeds ? <p className="mt-1 text-right text-[11px] text-destructive">More than the balance</p> : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <FormError message={formError ?? (errors.allocations ? errors.allocations[0] : null)} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="text-sm">
          Amount <span className="tabular text-lg font-semibold">{formatINR(total)}</span>
        </p>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending || !partyId || total.lte(0) || !!over}>
          <WalletIcon /> {pending ? "Recording…" : direction === "receipt" ? "Record receipt" : "Record payment"}
        </Button>
      </div>
    </form>
  )
}
