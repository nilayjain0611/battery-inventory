"use client"

import { useState, useTransition, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FormError } from "@/components/ui/field"
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { updateCompany } from "@/lib/actions/settings"

export interface CompanyValues {
  name: string
  legal_name: string
  gstin: string
  state_code: string
  address_line1: string
  address_line2: string
  city: string
  pincode: string
  phone: string
  email: string
  bank_name: string
  bank_account_number: string
  bank_ifsc: string
  invoice_terms: string
  invoice_footer: string
  overhead_per_unit_estimate: string
  is_demo_configuration: boolean
}

export function CompanyForm({ initial, states, readOnly }: { initial: CompanyValues; states: { code: string; name: string }[]; readOnly: boolean }) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [v, setV] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const set = <K extends keyof CompanyValues>(k: K, value: CompanyValues[K]) => setV((p) => ({ ...p, [k]: value }))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const res = await updateCompany(v)
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        setFormError(res.error)
        return
      }
      toast.success(res.message ?? "Saved")
    })
  }

  const text = (k: keyof CompanyValues, label: string, opts: { hint?: string; className?: string; mono?: boolean; required?: boolean } = {}) => (
    <Field label={label} htmlFor={k} error={errors[k]} hint={opts.hint} className={opts.className} required={opts.required}>
      <Input
        id={k}
        value={String(v[k])}
        disabled={readOnly}
        className={opts.mono ? "font-mono" : undefined}
        aria-invalid={!!errors[k]}
        onChange={(e) => set(k, e.target.value as never)}
      />
    </Field>
  )

  return (
    <form onSubmit={onSubmit} className="max-w-4xl space-y-5" noValidate>
      <Card>
        <CardHeader title="Legal identity" description="Printed on every invoice. Posted invoices keep the details they were issued with." />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {text("name", "Trading name", { required: true })}
          {text("legal_name", "Legal name", { required: true })}
          {text("gstin", "GSTIN", { mono: true, hint: "Must start with the state code" })}
          <Field label="State" htmlFor="state_code" required error={errors.state_code}>
            <Select id="state_code" value={v.state_code} disabled={readOnly} onChange={(e) => set("state_code", e.target.value)}>
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} · {s.name}
                </option>
              ))}
            </Select>
          </Field>
          {text("address_line1", "Address line 1")}
          {text("address_line2", "Address line 2")}
          {text("city", "City")}
          {text("pincode", "PIN code")}
          {text("phone", "Phone")}
          {text("email", "Email")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Bank details and invoice text" />
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {text("bank_name", "Bank")}
          {text("bank_account_number", "Account number", { mono: true })}
          {text("bank_ifsc", "IFSC", { mono: true })}
          <Field label="Terms printed on invoices" htmlFor="invoice_terms" className="sm:col-span-3">
            <Textarea id="invoice_terms" rows={3} disabled={readOnly} value={v.invoice_terms} onChange={(e) => set("invoice_terms", e.target.value)} />
          </Field>
          {text("invoice_footer", "Footer line", { className: "sm:col-span-3" })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Costing and readiness" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {text("overhead_per_unit_estimate", "Labour/overhead estimate per produced unit (₹)", {
            hint: "Blank = not configured. Shown on production orders as an estimate only.",
          })}
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <Checkbox className="mt-0.5" disabled={readOnly} checked={v.is_demo_configuration} onChange={(e) => set("is_demo_configuration", e.target.checked)} />
            <span>
              Demo configuration: invoices carry a &quot;not valid for statutory use&quot; banner. Untick only after your accountant has approved
              the company details, HSN codes and GST rates.
            </span>
          </label>
        </CardContent>
      </Card>
      <FormError message={formError} />
      {!readOnly ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save company settings"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Only the owner/admin can edit these settings.</p>
      )}
    </form>
  )
}
