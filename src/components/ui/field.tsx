import type { ReactNode } from "react"
import { cn } from "cn"

import { Label } from "./input"

/** Label + control + hint/error, with the error announced to screen readers. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string | string[] | null
  hint?: ReactNode
  required?: boolean
  className?: string
  children: ReactNode
}) {
  const message = Array.isArray(error) ? error[0] : error
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {message ? (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/** Form-level error banner. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  )
}
