import { Suspense, type ReactNode } from "react"

import { AppShell } from "@/components/layout/app-shell"
import { UserMenu } from "@/components/layout/user-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"
import { ROLE_LABELS } from "@/lib/domain/permissions"

async function CurrentUserMenu() {
  const user = await getCurrentUser()
  return (
    <UserMenu
      name={user.fullName}
      email={user.email}
      roleLabel={ROLE_LABELS[user.role]}
      companyName={user.companyName}
    />
  )
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      userMenu={
        <Suspense fallback={<Skeleton className="h-8 w-32" />}>
          <CurrentUserMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  )
}
