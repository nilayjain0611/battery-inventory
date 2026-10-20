import Form from "next/form"
import Link from "next/link"
import type { ReactNode } from "react"
import { SearchIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"

/** GET form: filters live in the URL, so they survive refresh and can be shared. */
export function FilterBar({ action, children, resetHref }: { action: string; children: ReactNode; resetHref: string }) {
  return (
    <Form action={action} className="mb-4 flex flex-wrap items-end gap-2">
      {children}
      <Button type="submit" variant="secondary">
        <SearchIcon /> Apply
      </Button>
      <Link href={resetHref} className={buttonVariants({ variant: "ghost" })}>
        Reset
      </Link>
    </Form>
  )
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  )
}
