import Decimal from "decimal.js"

// All money arithmetic goes through Decimal; never use floating point for money.
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP })

export { Decimal }

export type Numeric = number | string | Decimal

export function dec(value: Numeric | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0)
  try {
    return new Decimal(value)
  } catch {
    return new Decimal(0)
  }
}

/** Round half away from zero to 2 places (matches PostgreSQL round(numeric, 2)). */
export function round2(value: Numeric): Decimal {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})
const qtyFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 })
const plain2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** ₹1,23,456.78 */
export function formatINR(value: Numeric | null | undefined): string {
  return inr.format(dec(value).toNumber())
}

/** ₹1,23,457 (for KPI cards) */
export function formatINRCompact(value: Numeric | null | undefined): string {
  const d = dec(value)
  if (d.abs().gte(10000000)) return `₹${d.div(10000000).toDecimalPlaces(2).toString()} Cr`
  if (d.abs().gte(100000)) return `₹${d.div(100000).toDecimalPlaces(2).toString()} L`
  return inrWhole.format(d.toNumber())
}

/** 1,23,456.78 without the currency symbol (tables, PDFs). */
export function formatAmount(value: Numeric | null | undefined): string {
  return plain2.format(dec(value).toNumber())
}

export function formatQty(value: Numeric | null | undefined, uom?: string | null): string {
  const s = qtyFmt.format(dec(value).toNumber())
  return uom ? `${s} ${uom}` : s
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? `${ONES[h]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ")
}

/** Indian numbering: crore, lakh, thousand. Integer part only. */
function integerToWords(n: number): string {
  if (n === 0) return "Zero"
  const parts: string[] = []
  const crore = Math.floor(n / 10000000)
  n %= 10000000
  const lakh = Math.floor(n / 100000)
  n %= 100000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  if (crore) parts.push(`${integerToWords(crore)} Crore`)
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`)
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`)
  if (n) parts.push(belowThousand(n))
  return parts.join(" ")
}

/** "Rupees Eighty-Seven Thousand ... and Fifty Paise Only" */
export function amountInWords(value: Numeric): string {
  const d = round2(value)
  if (d.isNegative()) return `Minus ${amountInWords(d.abs())}`
  const rupees = d.floor().toNumber()
  const paise = d.minus(d.floor()).times(100).toDecimalPlaces(0).toNumber()
  const words = `Rupees ${integerToWords(rupees)}`
  return paise ? `${words} and ${belowHundred(paise)} Paise Only` : `${words} Only`
}
