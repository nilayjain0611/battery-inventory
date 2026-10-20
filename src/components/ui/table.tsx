import type { ComponentProps } from "react"
import { cn } from "cn"

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  )
}
export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-muted/60 [&_tr]:border-b", className)} {...props} />
}
export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
}
export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/40", className)} {...props} />
}
export function TH({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-9 px-3 text-left align-middle text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  )
}
export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />
}
/** Right-aligned numeric cell with tabular figures. */
export function TDNum({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("tabular px-3 py-2.5 text-right align-middle whitespace-nowrap", className)} {...props} />
}
