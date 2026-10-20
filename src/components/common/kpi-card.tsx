import Link from "next/link"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "cn"

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
  href?: string
  tone?: "default" | "warning" | "danger"
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col justify-between gap-3 rounded-lg border bg-card p-4 shadow-xs transition-colors",
        href && "hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-md",
            tone === "warning" ? "bg-warning/15 text-[oklch(0.5_0.12_60)]" : tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div>
        <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  )
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}
