import { ShieldAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/actions/auth"

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <ShieldAlertIcon className="mx-auto size-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">No company access</h1>
        <p className="text-sm text-muted-foreground">
          Your sign-in worked, but your account is not linked to a company yet. Ask the owner to add you under
          Settings → Users.
        </p>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  )
}
