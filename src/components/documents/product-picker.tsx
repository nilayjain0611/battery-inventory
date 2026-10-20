"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

import { fieldBase } from "@/components/ui/input"
import { formatQty } from "@/lib/domain/money"
import { STOCK_TYPE_LABELS } from "@/lib/format"

export interface PickerProduct {
  id: string
  sku: string
  name: string
  stock_type: "raw_material" | "manufactured" | "trading"
  uom: string
  quantity: number
  brand_name: string | null
}

/** Searchable product selector (type to filter by name, SKU or brand). */
export function ProductPicker({
  products,
  value,
  onChange,
  exclude = [],
  invalid,
  id,
}: {
  products: PickerProduct[]
  value: string
  onChange: (id: string) => void
  exclude?: string[]
  invalid?: boolean
  id?: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const selected = products.find((p) => p.id === value)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .filter((p) => p.id === value || !exclude.includes(p.id))
      .filter((p) => !q || `${p.sku} ${p.name} ${p.brand_name ?? ""}`.toLowerCase().includes(q))
      .slice(0, 50)
  }, [products, query, exclude, value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  function choose(pid: string) {
    onChange(pid)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={ref} className="relative min-w-56">
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid}
          autoComplete="off"
          className={cn(fieldBase, "h-9 pr-8")}
          placeholder={selected ? `${selected.sku} · ${selected.name}` : "Search product…"}
          value={open ? query : selected ? `${selected.sku} · ${selected.name}` : ""}
          onFocus={() => {
            setOpen(true)
            setActive(0)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, results.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === "Enter" && open && results[active]) {
              e.preventDefault()
              choose(results[active].id)
            } else if (e.key === "Escape") {
              setOpen(false)
            }
          }}
        />
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full min-w-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No products found</li>
          ) : (
            results.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={p.id === value}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(p.id)
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded px-2.5 py-1.5 text-sm",
                  i === active && "bg-muted",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    <span className="font-mono">{p.sku}</span> · {STOCK_TYPE_LABELS[p.stock_type]}
                    {p.brand_name ? ` · ${p.brand_name}` : ""}
                  </span>
                </span>
                <span className={cn("tabular shrink-0 text-xs", p.quantity <= 0 ? "text-destructive" : "text-muted-foreground")}>
                  {formatQty(p.quantity, p.uom)}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
