"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react"
import { BellIcon, MenuIcon, SearchIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { BrandMark } from "./brand"
import { NAV_SECTIONS, isActive } from "./nav-config"

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return <NavList pathname={pathname} onNavigate={onNavigate} />
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-5" aria-label="Main">
      {NAV_SECTIONS.map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-0.5">
          {section.title ? (
            <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-sidebar-foreground/50 uppercase">
              {section.title}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = pathname ? isActive(item, pathname) : false
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {active ? (
                  <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                ) : null}
                <Icon className={cn("size-4", active ? "text-sidebar-primary" : "opacity-70")} />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function GlobalSearch() {
  const router = useRouter()
  const [q, setQ] = useState("")
  function submit(e: FormEvent) {
    e.preventDefault()
    const term = q.trim()
    router.push(term ? `/inventory/products?q=${encodeURIComponent(term)}` : "/inventory/products")
  }
  return (
    <form onSubmit={submit} role="search" className="relative w-full max-w-md">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products by name, SKU or HSN…"
        aria-label="Search products"
        className="h-9 w-full rounded-md border border-input bg-card pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
      />
    </form>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button variant="ghost" size="icon" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <BellIcon />
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border bg-popover p-3 text-sm shadow-lg">
          <p className="font-medium">Notifications</p>
          <p className="mt-1 text-muted-foreground">
            Low-stock and overdue alerts appear on the dashboard. Push notifications are not enabled in this demo.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function AppShell({ userMenu, children }: { userMenu: ReactNode; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4">
      <Link href="/dashboard" className="px-2" onClick={onNavigate}>
        <BrandMark inverted />
      </Link>
      <Suspense fallback={<NavList pathname={null} />}>
        <NavLinks onNavigate={onNavigate} />
      </Suspense>
      <p className="mt-auto px-3 text-[11px] text-sidebar-foreground/50">Demo build · sample data</p>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 bg-sidebar lg:block">{sidebar()}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar shadow-xl animate-in slide-in-from-left">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close navigation"
              className="absolute top-4 right-2 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setMobileOpen(false)}
            >
              <XIcon />
            </Button>
            {sidebar(() => setMobileOpen(false))}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </Button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <Notifications />
            {userMenu}
          </div>
        </header>
        <main className="flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
