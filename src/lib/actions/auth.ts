"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

export interface SignInState {
  error?: string
  email?: string
}

const signInSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }),
  password: z.string().min(1, { error: "Enter your password" }),
  next: z.string().optional(),
})

function safeNext(next: string | undefined): string {
  // Only allow in-app paths to prevent open redirects.
  if (next && next.startsWith("/") && !next.startsWith("//")) return next
  return "/dashboard"
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: formData.get("next") ? String(formData.get("next")) : undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details", email: String(formData.get("email") ?? "") }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) {
    return {
      error: error.message === "Invalid login credentials" ? "Incorrect email or password" : error.message,
      email: parsed.data.email,
    }
  }
  redirect(safeNext(parsed.data.next))
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
