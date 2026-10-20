"use client"

import { useState, useTransition } from "react"
import { BanIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import type { ActionResult } from "@/lib/actions/result"

/** Controlled cancellation with a mandatory reason (recorded in the audit log). */
export function CancelButton({
  id,
  action,
  label = "Cancel document",
  title,
  description,
}: {
  id: string
  action: (input: { id: string; reason: string }) => Promise<ActionResult<unknown>>
  label?: string
  title: string
  description: string
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <BanIcon /> {label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        confirmLabel={label}
        destructive
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            setError(null)
            const res = await action({ id, reason })
            if (!res.ok) {
              setError(res.error)
              return
            }
            toast.success(res.message ?? "Cancelled")
            setOpen(false)
          })
        }
      >
        <Field label="Reason" htmlFor="cancel-reason" required error={error}>
          <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </>
  )
}
