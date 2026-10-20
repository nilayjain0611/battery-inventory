import { z } from "zod"

// Server-side validation for every mutation. The database re-validates too;
// these give fast, field-level feedback.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const id = z.string().regex(UUID, { error: "Invalid reference" })

const DATE = /^\d{4}-\d{2}-\d{2}$/
export const isoDate = z.string().regex(DATE, { error: "Use a valid date" })

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Keep this under ${max} characters` })
    .optional()
    .transform((v) => (v ? v : null))

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || GSTIN_PATTERN.test(v), { error: "GSTIN must be 15 characters, e.g. 27AABCV1234F1Z5" })

const stateCode = z.string().regex(/^[0-9]{2}$/, { error: "Choose a state" })

const money = z.coerce
  .number({ error: "Enter an amount" })
  .min(0, { error: "Cannot be negative" })
  .max(100_000_000, { error: "Amount is too large" })
  .refine((v) => Math.round(v * 100) === Number((v * 100).toFixed(6)), { error: "Use at most 2 decimal places" })

const quantity = z.coerce
  .number({ error: "Enter a quantity" })
  .gt(0, { error: "Must be greater than zero" })
  .max(1_000_000, { error: "Quantity is too large" })

export const stockTypes = ["raw_material", "manufactured", "trading"] as const
export const paymentMethods = ["cash", "upi", "bank_transfer", "cheque", "card", "other"] as const

// ---------------------------------------------------------------- products
export const productSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/, { error: "2–40 characters: letters, numbers, - and _" }),
    name: z.string().trim().min(1, { error: "Name is required" }).max(200),
    description: optionalText(1000),
    brand_id: id.optional().or(z.literal("")).transform((v) => v || null),
    category_id: id.optional().or(z.literal("")).transform((v) => v || null),
    stock_type: z.enum(stockTypes, { error: "Choose a stock type" }),
    uom: z.string().trim().toUpperCase().regex(/^[A-Z]{2,5}$/, { error: "2–5 letters, e.g. PCS, KG" }),
    hsn_code: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^[0-9]{4}([0-9]{2}){0,2}$/.test(v), { error: "HSN must be 4, 6 or 8 digits" }),
    gst_rate_code: z.string().min(1, { error: "Choose a GST rate" }),
    purchase_price: money,
    retail_price: money,
    wholesale_price: money,
    reorder_level: z.coerce.number().min(0, { error: "Cannot be negative" }).max(1_000_000),
    is_active: z.boolean().default(true),
  })
  .refine((p) => p.stock_type === "raw_material" || p.retail_price > 0 || p.wholesale_price > 0, {
    error: "Sellable products need a retail or wholesale price",
    path: ["retail_price"],
  })
export type ProductInput = z.input<typeof productSchema>

export const openingStockSchema = z.object({
  quantity,
  unit_cost: money,
})

export const stockAdjustmentSchema = z.object({
  idempotency_key: id,
  product_id: id,
  direction: z.enum(["increase", "decrease"]),
  quantity,
  unit_cost: money.optional(),
  reason: z.string().trim().min(3, { error: "Give a reason (at least 3 characters)" }).max(500),
  adjustment_date: isoDate,
})

// ---------------------------------------------------------------- parties
export const customerSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Name is required" }).max(200),
    customer_type: z.enum(["retail", "wholesale"]),
    contact_person: optionalText(120),
    gstin,
    state_code: stateCode,
    phone: optionalText(30),
    email: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || z.email().safeParse(v).success, { error: "Enter a valid email" }),
    billing_address: optionalText(500),
    shipping_address: optionalText(500),
    credit_days: z.coerce.number().int().min(0).max(365),
    is_active: z.boolean().default(true),
  })
  .refine((c) => !c.gstin || c.gstin.startsWith(c.state_code), {
    error: "The first two digits of the GSTIN must match the state code",
    path: ["gstin"],
  })
export type CustomerInput = z.input<typeof customerSchema>

export const supplierSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Name is required" }).max(200),
    contact_person: optionalText(120),
    gstin,
    state_code: stateCode,
    phone: optionalText(30),
    email: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || z.email().safeParse(v).success, { error: "Enter a valid email" }),
    address: optionalText(500),
    is_active: z.boolean().default(true),
  })
  .refine((c) => !c.gstin || c.gstin.startsWith(c.state_code), {
    error: "The first two digits of the GSTIN must match the state code",
    path: ["gstin"],
  })
export type SupplierInput = z.input<typeof supplierSchema>

// ---------------------------------------------------------------- purchases
export const purchaseSchema = z.object({
  idempotency_key: id,
  supplier_id: id,
  supplier_invoice_number: optionalText(60),
  purchase_date: isoDate,
  on_credit: z.boolean(),
  payment_method: z.enum(paymentMethods).optional(),
  payment_reference: optionalText(80),
  notes: optionalText(1000),
  lines: z
    .array(
      z.object({
        product_id: id,
        quantity,
        unit_price: money,
        discount_amount: money.default(0),
      }),
    )
    .min(1, { error: "Add at least one product" })
    .max(100),
})
export type PurchaseInput = z.input<typeof purchaseSchema>

// ---------------------------------------------------------------- sales
export const invoiceLineSchema = z.object({
  product_id: id,
  quantity,
  unit_price: money,
  discount_type: z.enum(["percent", "amount"]).nullable().optional(),
  discount_value: money.default(0),
})

export const invoiceSchema = z.object({
  idempotency_key: id,
  customer_id: id,
  sale_type: z.enum(["retail", "wholesale"]),
  invoice_date: isoDate,
  due_date: isoDate.optional().or(z.literal("")).transform((v) => v || null),
  place_of_supply: stateCode,
  prices_include_tax: z.boolean(),
  payment_terms: optionalText(200),
  billing_address: optionalText(500),
  shipping_address: optionalText(500),
  notes: optionalText(1000),
  lines: z.array(invoiceLineSchema).min(1, { error: "Add at least one product" }).max(100),
})
export type InvoiceInput = z.input<typeof invoiceSchema>

export const cancelSchema = z.object({
  id,
  reason: z.string().trim().min(3, { error: "Give a reason (at least 3 characters)" }).max(500),
})

// ---------------------------------------------------------------- production
export const productionOrderSchema = z.object({
  idempotency_key: id,
  bom_id: id,
  planned_quantity: quantity,
  production_date: isoDate,
  notes: optionalText(1000),
})

export const completeProductionSchema = z.object({
  id,
  produced_quantity: quantity,
  materials: z.array(
    z.object({
      product_id: id,
      actual_quantity: z.coerce.number().min(0, { error: "Cannot be negative" }).max(1_000_000),
    }),
  ),
  wastage_notes: optionalText(1000),
})

export const bomSchema = z.object({
  product_id: id,
  name: z.string().trim().min(2).max(120),
  output_quantity: quantity,
  notes: optionalText(500),
  lines: z
    .array(z.object({ component_product_id: id, quantity }))
    .min(1, { error: "Add at least one component" })
    .max(50),
})

// ---------------------------------------------------------------- payments
export const paymentSchema = z.object({
  idempotency_key: id,
  direction: z.enum(["receipt", "payment"]),
  party_id: id,
  payment_date: isoDate,
  method: z.enum(paymentMethods),
  reference: optionalText(80),
  notes: optionalText(500),
  allocations: z
    .array(z.object({ document_id: id, amount: money.refine((v) => v > 0, { error: "Must be greater than zero" }) }))
    .min(1, { error: "Allocate the payment to at least one document" })
    .max(50),
})
export type PaymentInput = z.input<typeof paymentSchema>

// ---------------------------------------------------------------- settings
export const companySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    legal_name: z.string().trim().min(2).max(200),
    gstin,
    state_code: stateCode,
    address_line1: optionalText(200),
    address_line2: optionalText(200),
    city: optionalText(80),
    pincode: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^[1-9][0-9]{5}$/.test(v), { error: "PIN code must be 6 digits" }),
    phone: optionalText(30),
    email: optionalText(120),
    bank_name: optionalText(120),
    bank_account_number: optionalText(40),
    bank_ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), { error: "IFSC looks like ABCD0123456" }),
    invoice_terms: optionalText(1000),
    invoice_footer: optionalText(300),
    overhead_per_unit_estimate: z
      .union([z.literal(""), z.coerce.number().min(0).max(1_000_000)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    is_demo_configuration: z.boolean(),
  })
  .refine((c) => !c.gstin || c.gstin.startsWith(c.state_code), {
    error: "The first two digits of the GSTIN must match the state code",
    path: ["gstin"],
  })

export const gstRateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,20}$/, { error: "2–20 letters, digits or _" }),
  description: z.string().trim().min(2).max(120),
  rate: z.coerce.number().min(0).max(40),
  effective_from: isoDate,
  is_sample: z.boolean(),
})

export const sequenceSchema = z.object({
  id,
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9/-]{1,12}$/, { error: "1–12 characters: letters, digits, / and -" }),
  padding: z.coerce.number().int().min(1).max(8),
})

export const membershipSchema = z.object({
  id,
  role: z.enum(["admin", "accounts", "sales", "inventory", "production"]),
  can_record_receipts: z.boolean(),
  is_active: z.boolean(),
})
