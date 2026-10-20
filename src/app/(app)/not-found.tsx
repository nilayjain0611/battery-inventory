import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-6 text-center">
      <h2 className="text-base font-semibold">Not found</h2>
      <p className="mt-1 text-sm text-muted-foreground">This record does not exist or belongs to another company.</p>
      <Link href="/dashboard" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
        Back to dashboard
      </Link>
    </div>
  )
}
