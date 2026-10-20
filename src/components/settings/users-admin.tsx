"use client"

import { useState, useTransition } from "react"
import { UserPlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader } from "@/components/ui/card"
import { Dialog } from "@/components/ui/dialog"
import { Field, FormError } from "@/components/ui/field"
import { Checkbox, Input, Select } from "@/components/ui/input"
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { createUser, updateMembership } from "@/lib/actions/settings"
import { ROLE_LABELS, type AppRole } from "@/lib/domain/permissions"

export interface MemberRow {
  id: string
  user_id: string
  name: string
  email: string
  role: AppRole
  can_record_receipts: boolean
  is_active: boolean
  is_self: boolean
}

const ROLE_HELP: Record<AppRole, string> = {
  admin: "Everything, including settings, users and audit history",
  accounts: "Invoices, payments, balances, cancellations",
  sales: "Invoices and customers; receipts only if granted",
  inventory: "Products, purchases, stock counts and adjustments",
  production: "Bills of materials and production orders",
}

export function UsersAdmin({ members, isAdmin, canCreate }: { members: MemberRow[]; isAdmin: boolean; canCreate: boolean }) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "sales" as AppRole })
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [formError, setFormError] = useState<string | null>(null)

  function update(m: MemberRow, patch: Partial<Pick<MemberRow, "role" | "can_record_receipts" | "is_active">>) {
    startTransition(async () => {
      const res = await updateMembership({
        id: m.id,
        role: patch.role ?? m.role,
        can_record_receipts: patch.can_record_receipts ?? m.can_record_receipts,
        is_active: patch.is_active ?? m.is_active,
      })
      if (res.ok) toast.success(res.message ?? "Updated")
      else toast.error("Not updated", res.error)
    })
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Team members"
          description="Roles are enforced by the server and the database, not only by hiding buttons."
          action={
            isAdmin ? (
              <Button size="sm" onClick={() => setOpen(true)}>
                <UserPlusIcon /> Add user
              </Button>
            ) : null
          }
        />
        <Table>
          <THead>
            <TR>
              <TH>User</TH>
              <TH>Role</TH>
              <TH>Customer receipts</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {members.map((m) => (
              <TR key={m.id}>
                <TD>
                  <p className="font-medium">
                    {m.name} {m.is_self ? <Badge className="ml-1">You</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </TD>
                <TD>
                  {isAdmin && !m.is_self ? (
                    <Select value={m.role} disabled={pending} onChange={(e) => update(m, { role: e.target.value as AppRole })} className="w-48" aria-label="Role">
                      {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    ROLE_LABELS[m.role]
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{ROLE_HELP[m.role]}</p>
                </TD>
                <TD>
                  {m.role === "sales" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={m.can_record_receipts}
                        disabled={!isAdmin || pending}
                        onChange={(e) => update(m, { can_record_receipts: e.target.checked })}
                      />
                      Allowed
                    </label>
                  ) : (
                    <span className="text-xs text-muted-foreground">{m.role === "admin" || m.role === "accounts" ? "Always" : "No"}</span>
                  )}
                </TD>
                <TD>
                  {isAdmin && !m.is_self ? (
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => update(m, { is_active: !m.is_active })}>
                      {m.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  ) : null}
                  {m.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add user"
        description={
          canCreate
            ? "Creates a sign-in with this password and links it to your company. Share the password privately; there is no public sign-up."
            : "Adding users here needs SUPABASE_SERVICE_ROLE_KEY on the server. Alternatively create the user in the Supabase dashboard (Authentication → Users), then assign a role here."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending || !canCreate}
              onClick={() =>
                startTransition(async () => {
                  setErrors({})
                  setFormError(null)
                  const res = await createUser(form)
                  if (!res.ok) {
                    setErrors(res.fieldErrors ?? {})
                    setFormError(res.error)
                    return
                  }
                  toast.success(res.message ?? "User added")
                  setOpen(false)
                  setForm({ full_name: "", email: "", password: "", role: "sales" })
                })
              }
            >
              {pending ? "Adding…" : "Add user"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="u-name" error={errors.full_name}>
            <Input id="u-name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </Field>
          <Field label="Email" htmlFor="u-email" error={errors.email}>
            <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Temporary password" htmlFor="u-pass" error={errors.password} hint="At least 10 characters">
            <Input id="u-pass" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </Field>
          <Field label="Role" htmlFor="u-role">
            <Select id="u-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole }))}>
              {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <FormError message={formError} />
        </div>
      </Dialog>
    </div>
  )
}
