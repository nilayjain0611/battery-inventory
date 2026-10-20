import type { Enums } from "@/lib/database.types"

export type AppRole = Enums<"app_role">

/**
 * UI-level capability map: decides which buttons and pages to show.
 * The database enforces the same rules (private.require_role and RLS), so
 * hiding a control here is a convenience, never the security boundary.
 */
const CAPABILITIES = {
  "products.manage": ["admin", "inventory"],
  "stock.adjust": ["admin", "inventory"],
  "customers.manage": ["admin", "accounts", "sales"],
  "suppliers.manage": ["admin", "accounts", "inventory"],
  "purchases.create": ["admin", "inventory", "accounts"],
  "purchases.cancel": ["admin", "accounts"],
  "production.manage": ["admin", "production"],
  "sales.create": ["admin", "sales", "accounts"],
  "sales.cancelPosted": ["admin", "accounts"],
  "payments.supplier": ["admin", "accounts"],
  "settings.manage": ["admin"],
  "audit.view": ["admin"],
} as const satisfies Record<string, readonly AppRole[]>

export type Capability = keyof typeof CAPABILITIES

export function can(role: AppRole | null | undefined, capability: Capability): boolean {
  if (!role) return false
  return (CAPABILITIES[capability] as readonly AppRole[]).includes(role)
}

/** Receipts: admin/accounts always; sales only when granted per user. */
export function canRecordReceipts(role: AppRole | null | undefined, granted: boolean): boolean {
  return role === "admin" || role === "accounts" || (role === "sales" && granted)
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Owner / Admin",
  accounts: "Accounts / Billing",
  sales: "Sales",
  inventory: "Inventory",
  production: "Production",
}
