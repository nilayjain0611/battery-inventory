"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

const TABS = [
  { href: "/settings/company", label: "Company" },
  { href: "/settings/tax", label: "Tax & numbering" },
  { href: "/settings/users", label: "Users & roles" },
  { href: "/settings/audit", label: "Audit log" },
]

export function SettingsTabs() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-wrap gap-1 border-b" aria-label="Settings">
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
