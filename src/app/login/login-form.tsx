"use client"

import { useActionState, useState } from "react"
import { useSearchParams } from "next/navigation"
import { LogInIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FormError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signIn, type SignInState } from "@/lib/actions/auth"

export function LoginForm({ demoAccounts }: { demoAccounts: { email: string; role: string }[] }) {
  const searchParams = useSearchParams()
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {})
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email || state.email || ""}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <FormError message={state.error} />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          <LogInIcon />
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {demoAccounts.length > 0 ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Demo accounts · password Demo@12345</p>
          <div className="mt-2 grid gap-1">
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email)
                  setPassword("Demo@12345")
                }}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-card"
              >
                <span className="font-mono">{a.email}</span>
                <span className="text-muted-foreground">{a.role}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
