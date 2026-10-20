"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { CheckCircle2Icon, CircleAlertIcon, InfoIcon, XIcon } from "lucide-react"
import { cn } from "cn"

type Tone = "success" | "error" | "info"
interface ToastItem {
  id: number
  tone: Tone
  title: string
  description?: string
}

interface ToastApi {
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (tone: Tone, title: string, description?: string) => {
      const id = nextId++
      setItems((all) => [...all.slice(-3), { id, tone, title, description }])
      setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
    }),
    [push],
  )

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-card p-3 shadow-lg animate-in fade-in slide-in-from-bottom-2",
              t.tone === "error" && "border-destructive/30",
            )}
          >
            {t.tone === "success" ? (
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" />
            ) : t.tone === "error" ? (
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : (
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p> : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}
