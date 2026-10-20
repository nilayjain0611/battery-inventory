import type { Metadata } from "next"
import { Suspense } from "react"

import { BrandMark } from "@/components/layout/brand"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Sign in" }

const DEMO_ACCOUNTS = [
  { email: "admin@voltaxis-demo.test", role: "Owner / Admin" },
  { email: "accounts@voltaxis-demo.test", role: "Accounts" },
  { email: "sales@voltaxis-demo.test", role: "Sales" },
  { email: "inventory@voltaxis-demo.test", role: "Inventory" },
  { email: "production@voltaxis-demo.test", role: "Production" },
]

export default function LoginPage() {
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <BrandMark inverted />
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Every battery, every rupee, traced to its source.
          </h1>
          <p className="text-sm leading-relaxed text-sidebar-foreground/80">
            Raw materials, production runs, own-brand and third-party stock, GST invoices and receivables in one
            system, with a stock ledger behind every number.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Demonstration build · sample data only</p>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border-[40px] border-sidebar-primary/10"
        />
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use the account your administrator created for you.</p>
          </div>
          <Suspense fallback={<div className="h-48" />}>
            <LoginForm demoAccounts={demo ? DEMO_ACCOUNTS : []} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
