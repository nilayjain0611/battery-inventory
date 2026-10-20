"use client"

import { useCallback, useRef } from "react"

/**
 * One key per logical submission. Retries and double-clicks reuse the same key,
 * so the server records the document once; call reset() after success.
 * Generated lazily (in an event handler), never during render.
 */
export function useIdempotencyKey() {
  const ref = useRef<string | null>(null)
  const get = useCallback(() => {
    if (!ref.current) ref.current = crypto.randomUUID()
    return ref.current
  }, [])
  const reset = useCallback(() => {
    ref.current = null
  }, [])
  return { get, reset }
}
