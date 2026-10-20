"use client"

import { useEffect } from "react"
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const message = error instanceof Error ? error.message : "Unexpected error"
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : ""

  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-6 text-center shadow-xs">
      <TriangleAlertIcon className="mx-auto size-8 text-destructive" />
      <h2 className="mt-3 text-base font-semibold">This page could not be loaded</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {digest ? <p className="mt-2 font-mono text-[11px] text-muted-foreground">Reference: {digest}</p> : null}
      <Button className="mt-4" onClick={() => retry()}>
        <RotateCwIcon /> Try again
      </Button>
    </div>
  )
}
