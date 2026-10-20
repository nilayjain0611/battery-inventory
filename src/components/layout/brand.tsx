import { ZapIcon } from "lucide-react"
import { cn } from "cn"

export function BrandMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
        <ZapIcon className="size-4.5" strokeWidth={2.5} />
      </span>
      <span className="leading-tight">
        <span className={cn("block text-sm font-semibold tracking-tight", inverted ? "text-white" : "text-foreground")}>
          Voltaxis ERP
        </span>
        <span className={cn("block text-[11px]", inverted ? "text-sidebar-foreground/70" : "text-muted-foreground")}>
          Batteries · Manufacturing & Trading
        </span>
      </span>
    </div>
  )
}
