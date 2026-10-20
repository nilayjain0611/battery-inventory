import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { InboxIcon } from "lucide-react"

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function NotAllowed({ what }: { what: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <p className="text-sm font-medium">Your role cannot {what}.</p>
      <p className="mt-1 text-sm text-muted-foreground">Ask the owner to change your role if you need access.</p>
    </div>
  )
}

export function LoadError({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      Could not load this data: {message}
    </div>
  )
}
