import type { ComponentProps } from "react"
import { cn } from "cn"

export const fieldBase =
  "w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-sm text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-destructive/15"

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldBase, "h-9", className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldBase, "min-h-20 py-2", className)} {...props} />
}

/** Native select: reliable, accessible, works on every device. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select data-slot="select" className={cn(fieldBase, "h-9 pr-8", className)} {...props}>
      {children}
    </select>
  )
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />
}

export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn("size-4 rounded border-input accent-primary align-middle", className)}
      {...props}
    />
  )
}
