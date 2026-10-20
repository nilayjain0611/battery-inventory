"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDownIcon, LogOutIcon } from "lucide-react"

import { signOut } from "@/lib/actions/auth"

export function UserMenu({ name, email, roleLabel, companyName }: { name: string; email: string; roleLabel: string; companyName: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const initials = name
    .replace(/\(.*\)/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials || "U"}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-40 truncate text-sm font-medium">{name}</span>
          <span className="block text-[11px] text-muted-foreground">{roleLabel}</span>
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 rounded-lg border bg-popover p-1 shadow-lg">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {roleLabel} · {companyName}
            </p>
          </div>
          <div className="my-1 h-px bg-border" />
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              <LogOutIcon className="size-4" /> Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
