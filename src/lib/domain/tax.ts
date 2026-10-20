import { dec, Decimal, round2, type Numeric } from "./money.ts"

/**
 * Client-side mirror of private.calc_line in the database, used ONLY for the
 * live preview while a user types. The server recomputes every figure when a
 * document is saved or posted; these numbers are never sent as authoritative.
 */

export type SupplyType = "intra_state" | "inter_state"
export type DiscountType = "percent" | "amount"

export interface LineInput {
  quantity: Numeric
  unitPrice: Numeric
  discountType?: DiscountType | null
  discountValue?: Numeric | null
  gstRate: Numeric
}

export interface LineResult {
  gross: Decimal
  discount: Decimal
  taxable: Decimal
  cgst: Decimal
  sgst: Decimal
  igst: Decimal
  total: Decimal
  error?: string
}

const ZERO = new Decimal(0)

export function calcLine(line: LineInput, pricesIncludeTax: boolean, supply: SupplyType): LineResult {
  const qty = dec(line.quantity)
  const price = dec(line.unitPrice)
  const rate = dec(line.gstRate)
  const empty: LineResult = { gross: ZERO, discount: ZERO, taxable: ZERO, cgst: ZERO, sgst: ZERO, igst: ZERO, total: ZERO }

  if (qty.lte(0)) return { ...empty, error: "Quantity must be greater than zero" }
  if (price.isNegative()) return { ...empty, error: "Price cannot be negative" }

  const gross = round2(qty.times(price))
  const discValue = dec(line.discountValue)
  if (discValue.isNegative()) return { ...empty, gross, error: "Discount cannot be negative" }

  let discount = ZERO
  if (line.discountType === "percent") {
    if (discValue.gt(100)) return { ...empty, gross, error: "Discount percentage cannot exceed 100" }
    discount = round2(gross.times(discValue).div(100))
  } else if (line.discountType === "amount") {
    discount = round2(discValue)
  }
  if (discount.gt(gross)) return { ...empty, gross, error: "Discount exceeds the line value" }

  const net = gross.minus(discount)

  if (pricesIncludeTax) {
    const taxable = round2(net.times(100).div(rate.plus(100)))
    const tax = net.minus(taxable)
    if (supply === "intra_state") {
      const cgst = round2(tax.div(2))
      return { gross, discount, taxable, cgst, sgst: tax.minus(cgst), igst: ZERO, total: net }
    }
    return { gross, discount, taxable, cgst: ZERO, sgst: ZERO, igst: tax, total: net }
  }

  const taxable = net
  if (supply === "intra_state") {
    const half = round2(taxable.times(rate).div(200))
    return { gross, discount, taxable, cgst: half, sgst: half, igst: ZERO, total: taxable.plus(half).plus(half) }
  }
  const igst = round2(taxable.times(rate).div(100))
  return { gross, discount, taxable, cgst: ZERO, sgst: ZERO, igst, total: taxable.plus(igst) }
}

export interface DocumentTotals {
  subtotal: Decimal
  discount: Decimal
  cgst: Decimal
  sgst: Decimal
  igst: Decimal
  tax: Decimal
  beforeRound: Decimal
  roundOff: Decimal
  grandTotal: Decimal
}

export function sumLines(lines: LineResult[], roundToRupee: boolean): DocumentTotals {
  const t = lines.reduce(
    (acc, l) => ({
      subtotal: acc.subtotal.plus(l.taxable),
      discount: acc.discount.plus(l.discount),
      cgst: acc.cgst.plus(l.cgst),
      sgst: acc.sgst.plus(l.sgst),
      igst: acc.igst.plus(l.igst),
      beforeRound: acc.beforeRound.plus(l.total),
    }),
    { subtotal: ZERO, discount: ZERO, cgst: ZERO, sgst: ZERO, igst: ZERO, beforeRound: ZERO },
  )
  const grandTotal = roundToRupee ? t.beforeRound.toDecimalPlaces(0, Decimal.ROUND_HALF_UP) : t.beforeRound
  return {
    ...t,
    tax: t.cgst.plus(t.sgst).plus(t.igst),
    roundOff: grandTotal.minus(t.beforeRound),
    grandTotal,
  }
}

export function supplyTypeFor(sellerState: string, placeOfSupply: string): SupplyType {
  return sellerState === placeOfSupply ? "intra_state" : "inter_state"
}
