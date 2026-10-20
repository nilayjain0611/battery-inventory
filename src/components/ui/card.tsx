import type { ComponentProps, ReactNode } from "react"
import { cn } from "cn"

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-lg border bg-card text-card-foreground shadow-xs", className)} {...props} />
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />
}
