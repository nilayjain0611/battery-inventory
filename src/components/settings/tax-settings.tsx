"use client"

import { useState, useTransition } from "react"
import { PlusIcon, ShieldCheckIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FormError } from "@/components/ui/field"
import { Checkbox, Input } from "@/components/ui/input"
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { addGstRateVersion, markRateVerified, updateSequence } from "@/lib/actions/settings"
import { formatDate } from "@/lib/format"

export interface RateRow {
  id: string
  code: string
  description: string
  rate: number
  effective_from: string
  is_sample: boolean
  in_effect: boolean
}
export interface SequenceRow {
  id: string
  doc_type: string
  prefix: string
  fiscal_year: string
  next_number: number
  padding: number
}

const DOC_LABELS: Record<string, string> = {
  sales_invoice: "Sales invoices",
  purchase: "Purchases",
  production_order: "Production orders",
  payment_receipt: "Customer receipts",
  payment_made: "Supplier payments",
  stock_adjustment: "Stock adjustments",
}

export function TaxSettings({ rates, sequences, isAdmin, today }: { rates: RateRow[]; sequences: SequenceRow[]; isAdmin: boolean; today: string }) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ code: "", description: "", rate: "", effective_from: today, is_sample: true })
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [seq, setSeq] = useState<Record<string, { prefix: string; padding: string }>>(
    Object.fromEntries(sequences.map((s) => [s.id, { prefix: s.prefix, padding: String(s.padding) }])),
  )

  function addRate() {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const res = await addGstRateVersion(form)
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        setFormError(res.error)
        return
      }
      toast.success(res.message ?? "Rate added")
      setForm({ code: "", description: "", rate: "", effective_from: today, is_sample: true })
    })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-[oklch(0.42_0.1_60)]">
        GST rates here are configuration, not advice. Seeded rates are <strong>unverified samples</strong>; confirm each product&apos;s HSN
        code and rate with your accountant, then mark the rate as verified. Rates are versioned: to change a rate, add a new version with
        the date it takes effect. Posted invoices keep the rate they were issued with.
      </div>

      <Card>
        <CardHeader title="GST rate versions" description="The version in effect on a document's date is applied when it is posted." />
        <Table>
          <THead>
            <TR>
              <TH>Code</TH>
              <TH>Description</TH>
              <TH className="text-right">Rate</TH>
              <TH>Effective from</TH>
              <TH>Status</TH>
              {isAdmin ? <TH /> : null}
            </TR>
          </THead>
          <TBody>
            {rates.map((r) => (
              <TR key={r.id} className={r.in_effect ? undefined : "opacity-60"}>
                <TD className="font-mono text-xs">{r.code}</TD>
                <TD>{r.description}</TD>
                <TD className="tabular text-right font-medium">{r.rate}%</TD>
                <TD>
                  {formatDate(r.effective_from)} {r.in_effect ? <Badge tone="info" className="ml-1">In effect</Badge> : null}
                </TD>
                <TD>{r.is_sample ? <Badge tone="warning">Sample · unverified</Badge> : <Badge tone="success">Verified</Badge>}</TD>
                {isAdmin ? (
                  <TD className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await markRateVerified({ id: r.id, verified: r.is_sample })
                          if (res.ok) toast.success(res.message ?? "Updated")
                          else toast.error("Not updated", res.error)
                        })
                      }
                    >
                      <ShieldCheckIcon /> {r.is_sample ? "Mark verified" : "Mark sample"}
                    </Button>
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
        {isAdmin ? (
          <CardContent className="border-t">
            <p className="mb-3 text-sm font-medium">Add a rate version</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Code" htmlFor="r-code" error={errors.code} hint="e.g. GST18">
                <Input id="r-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
              </Field>
              <Field label="Description" htmlFor="r-desc" error={errors.description} className="lg:col-span-2">
                <Input id="r-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </Field>
              <Field label="Rate %" htmlFor="r-rate" error={errors.rate}>
                <Input id="r-rate" type="number" min="0" max="40" step="0.01" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
              </Field>
              <Field label="Effective from" htmlFor="r-from" error={errors.effective_from}>
                <Input id="r-from" type="date" value={form.effective_from} onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))} />
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_sample} onChange={(e) => setForm((f) => ({ ...f, is_sample: e.target.checked }))} /> Sample (not yet verified)
            </label>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={addRate} disabled={pending}>
                <PlusIcon /> Add version
              </Button>
              <FormError message={formError} />
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Document numbering" description="Gap-free per financial year (April–March). Numbers are allocated only when a document is posted." />
        <Table>
          <THead>
            <TR>
              <TH>Document</TH>
              <TH>Financial year</TH>
              <TH>Prefix</TH>
              <TH>Digits</TH>
              <TH>Next number</TH>
              {isAdmin ? <TH /> : null}
            </TR>
          </THead>
          <TBody>
            {sequences.map((s) => {
              const v = seq[s.id]
              return (
                <TR key={s.id}>
                  <TD>{DOC_LABELS[s.doc_type] ?? s.doc_type}</TD>
                  <TD>{s.fiscal_year}</TD>
                  <TD>
                    {isAdmin ? (
                      <Input className="w-24 font-mono" value={v.prefix} onChange={(e) => setSeq((x) => ({ ...x, [s.id]: { ...v, prefix: e.target.value.toUpperCase() } }))} aria-label="Prefix" />
                    ) : (
                      <span className="font-mono">{s.prefix}</span>
                    )}
                  </TD>
                  <TD>
                    {isAdmin ? (
                      <Input className="w-16" type="number" min="1" max="8" value={v.padding} onChange={(e) => setSeq((x) => ({ ...x, [s.id]: { ...v, padding: e.target.value } }))} aria-label="Digits" />
                    ) : (
                      s.padding
                    )}
                  </TD>
                  <TD className="font-mono text-xs">
                    {v.prefix}/{s.fiscal_year}/{String(s.next_number).padStart(Number(v.padding) || 1, "0")}
                  </TD>
                  {isAdmin ? (
                    <TD className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending || (v.prefix === s.prefix && v.padding === String(s.padding))}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await updateSequence({ id: s.id, prefix: v.prefix, padding: v.padding })
                            if (res.ok) toast.success(res.message ?? "Saved")
                            else toast.error("Not saved", res.error)
                          })
                        }
                      >
                        Save
                      </Button>
                    </TD>
                  ) : null}
                </TR>
              )
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  )
}
