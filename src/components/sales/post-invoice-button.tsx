"use client"

import { useState, useTransition } from "react"
import { SendIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { postInvoice } from "@/lib/actions/sales"

export function PostInvoiceButton({ id, total }: { id: string; total: string }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <SendIcon /> Post invoice
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Post this invoice?"
        confirmLabel="Post invoice"
        pending={pending}
        description={`Recalculates taxes from the current GST configuration, allocates the invoice number and removes the items from stock. Total ${total}.`}
        onConfirm={() =>
          startTransition(async () => {
            setError(null)
            const res = await postInvoice({ id })
            if (!res.ok) {
              setError(res.error)
              return
            }
            toast.success(res.message ?? "Posted")
            setOpen(false)
          })
        }
      >
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </ConfirmDialog>
    </>
  )
}
