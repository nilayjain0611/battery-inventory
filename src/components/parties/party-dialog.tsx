"use client"

import { useState, useTransition } from "react"
import { PencilIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Field, FormError } from "@/components/ui/field"
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { saveCustomer, saveSupplier } from "@/lib/actions/parties"

type Errors = Record<string, string[] | undefined>

export interface PartyValues {
  name: string
  customer_type: "retail" | "wholesale"
  contact_person: string
  gstin: string
  state_code: string
  phone: string
  email: string
  billing_address: string
  shipping_address: string
  credit_days: string
  is_active: boolean
}

export const emptyParty = (stateCode: string): PartyValues => ({
  name: "",
  customer_type: "retail",
  contact_person: "",
  gstin: "",
  state_code: stateCode,
  phone: "",
  email: "",
  billing_address: "",
  shipping_address: "",
  credit_days: "0",
  is_active: true,
})

export function PartyDialog({
  kind,
  id,
  initial,
  states,
  isWalkIn,
}: {
  kind: "customer" | "supplier"
  id?: string
  initial: PartyValues
  states: { code: string; name: string }[]
  isWalkIn?: boolean
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [v, setV] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const set = <K extends keyof PartyValues>(k: K, value: PartyValues[K]) => setV((p) => ({ ...p, [k]: value }))

  function submit() {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const res =
        kind === "customer"
          ? await saveCustomer({ id, values: v })
          : await saveSupplier({
              id,
              values: {
                name: v.name,
                contact_person: v.contact_person,
                gstin: v.gstin,
                state_code: v.state_code,
                phone: v.phone,
                email: v.email,
                address: v.billing_address,
                is_active: v.is_active,
              },
            })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        setFormError(res.error)
        return
      }
      toast.success(res.message ?? "Saved")
      setOpen(false)
      if (!id) setV(initial)
    })
  }

  const label = kind === "customer" ? "customer" : "supplier"

  return (
    <>
      {id ? (
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${label}`} onClick={() => setOpen(true)}>
          <PencilIcon />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <PlusIcon /> New {label}
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={id ? `Edit ${label}` : `New ${label}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="p-name" required error={errors.name} className="sm:col-span-2">
            <Input id="p-name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />
          </Field>
          {kind === "customer" ? (
            <Field label="Customer type" htmlFor="p-type" hint="Wholesale customers default to GST-exclusive pricing">
              <Select
                id="p-type"
                value={v.customer_type}
                disabled={isWalkIn}
                onChange={(e) => set("customer_type", e.target.value as PartyValues["customer_type"])}
              >
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale / dealer</option>
              </Select>
            </Field>
          ) : null}
          <Field label="Contact person" htmlFor="p-contact" error={errors.contact_person}>
            <Input id="p-contact" value={v.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
          </Field>
          <Field label="State" htmlFor="p-state" required error={errors.state_code} hint="Decides CGST+SGST or IGST">
            <Select id="p-state" value={v.state_code} onChange={(e) => set("state_code", e.target.value)}>
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} · {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="GSTIN" htmlFor="p-gstin" error={errors.gstin} hint="Leave blank for unregistered parties">
            <Input
              id="p-gstin"
              value={v.gstin}
              maxLength={15}
              onChange={(e) => set("gstin", e.target.value.toUpperCase())}
              aria-invalid={!!errors.gstin}
              className="font-mono"
            />
          </Field>
          <Field label="Phone" htmlFor="p-phone" error={errors.phone}>
            <Input id="p-phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="p-email" error={errors.email}>
            <Input id="p-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
          </Field>
          {kind === "customer" ? (
            <Field label="Credit days" htmlFor="p-credit" error={errors.credit_days} hint="Sets the default due date">
              <Input id="p-credit" type="number" min="0" max="365" value={v.credit_days} onChange={(e) => set("credit_days", e.target.value)} />
            </Field>
          ) : null}
          <Field
            label={kind === "customer" ? "Billing address" : "Address"}
            htmlFor="p-bill"
            error={errors.billing_address ?? errors.address}
            className="sm:col-span-2"
          >
            <Textarea id="p-bill" rows={2} value={v.billing_address} onChange={(e) => set("billing_address", e.target.value)} />
          </Field>
          {kind === "customer" ? (
            <Field label="Shipping address" htmlFor="p-ship" hint="Blank = same as billing" className="sm:col-span-2">
              <Textarea id="p-ship" rows={2} value={v.shipping_address} onChange={(e) => set("shipping_address", e.target.value)} />
            </Field>
          ) : null}
          {!isWalkIn ? (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Active
            </label>
          ) : null}
        </div>
        <div className="mt-4">
          <FormError message={formError} />
        </div>
      </Dialog>
    </>
  )
}
