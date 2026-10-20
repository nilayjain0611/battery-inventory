import type { ComponentProps } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-primary/20 bg-primary/8 text-primary",
        success: "border-success/25 bg-success/10 text-success",
        warning: "border-warning/40 bg-warning/15 text-[oklch(0.45_0.11_60)]",
        danger: "border-destructive/25 bg-destructive/8 text-destructive",
        brand: "border-[oklch(0.8_0.15_78)]/50 bg-[oklch(0.8_0.15_78)]/15 text-[oklch(0.42_0.1_65)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
