"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { XIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "./button"

/**
 * Modal dialog built on the native <dialog> element (focus trapping, Esc to
 * close and the backdrop come from the browser).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: "sm" | "md" | "lg" | "xl"
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className={cn(
        "m-auto max-h-[90vh] w-[calc(100%-2rem)] overflow-hidden rounded-xl border bg-card p-0 text-card-foreground shadow-xl",
        size === "sm" && "max-w-sm",
        size === "md" && "max-w-lg",
        size === "lg" && "max-w-2xl",
        size === "xl" && "max-w-4xl",
      )}
    >
      {open ? (
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
              <XIcon />
            </Button>
          </div>
          {children ? <div className="overflow-y-auto px-5 py-4">{children}</div> : null}
          {footer ? <div className="flex justify-end gap-2 border-t bg-muted/40 px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  )
}

/** Confirmation for irreversible operations. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  pending,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  destructive?: boolean
  pending?: boolean
  children?: ReactNode
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={pending}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}
