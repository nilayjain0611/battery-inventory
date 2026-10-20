// Run with: npm test
// Expected values were produced by the database tax engine (private.calc_line),
// so these tests also guard the UI preview against drifting from the server.
import assert from "node:assert/strict"
import { test } from "node:test"

import { amountInWords, formatINR } from "./money.ts"
import { calcLine, sumLines, supplyTypeFor } from "./tax.ts"

test("exclusive price, intra-state: CGST + SGST on top", () => {
  const r = calcLine({ quantity: 10, unitPrice: 5450, gstRate: 18 }, false, "intra_state")
  assert.equal(r.taxable.toFixed(2), "54500.00")
  assert.equal(r.cgst.toFixed(2), "4905.00")
  assert.equal(r.sgst.toFixed(2), "4905.00")
  assert.equal(r.igst.toFixed(2), "0.00")
  assert.equal(r.total.toFixed(2), "64310.00")
})

test("exclusive price with percent discount", () => {
  const r = calcLine({ quantity: 6, unitPrice: 3350, discountType: "percent", discountValue: 2, gstRate: 18 }, false, "intra_state")
  assert.equal(r.discount.toFixed(2), "402.00")
  assert.equal(r.taxable.toFixed(2), "19698.00")
  assert.equal(r.cgst.toFixed(2), "1772.82")
})

test("inter-state supply uses IGST only", () => {
  const r = calcLine({ quantity: 12, unitPrice: 10450, gstRate: 18 }, false, "inter_state")
  assert.equal(r.igst.toFixed(2), "22572.00")
  assert.equal(r.cgst.toFixed(2), "0.00")
  assert.equal(r.total.toFixed(2), "147972.00")
})

test("inclusive (retail shelf) price: total equals the price, tax extracted", () => {
  const r = calcLine({ quantity: 2, unitPrice: 1499, gstRate: 18 }, true, "intra_state")
  assert.equal(r.total.toFixed(2), "2998.00")
  assert.equal(r.taxable.toFixed(2), "2540.68")
  assert.equal(r.cgst.plus(r.sgst).toFixed(2), "457.32")
})

test("inclusive price with amount discount, odd paise split", () => {
  const r = calcLine({ quantity: 1, unitPrice: 13999, discountType: "amount", discountValue: 500, gstRate: 18 }, true, "intra_state")
  assert.equal(r.taxable.toFixed(2), "11439.83")
  assert.equal(r.cgst.toFixed(2), "1029.59")
  assert.equal(r.sgst.toFixed(2), "1029.58")
  assert.equal(r.total.toFixed(2), "13499.00")
})

test("invalid inputs are flagged", () => {
  assert.ok(calcLine({ quantity: 0, unitPrice: 10, gstRate: 18 }, false, "intra_state").error)
  assert.ok(calcLine({ quantity: 1, unitPrice: -1, gstRate: 18 }, false, "intra_state").error)
  assert.ok(calcLine({ quantity: 1, unitPrice: 10, discountType: "percent", discountValue: 101, gstRate: 18 }, false, "intra_state").error)
  assert.ok(calcLine({ quantity: 1, unitPrice: 10, discountType: "amount", discountValue: 11, gstRate: 18 }, false, "intra_state").error)
})

test("document totals round to the nearest rupee", () => {
  const lines = [
    calcLine({ quantity: 10, unitPrice: 5450, gstRate: 18 }, false, "intra_state"),
    calcLine({ quantity: 6, unitPrice: 3350, discountType: "percent", discountValue: 2, gstRate: 18 }, false, "intra_state"),
  ]
  const t = sumLines(lines, true)
  assert.equal(t.subtotal.toFixed(2), "74198.00")
  assert.equal(t.roundOff.toFixed(2), "0.36")
  assert.equal(t.grandTotal.toFixed(2), "87554.00")
})

test("supply type follows the place of supply", () => {
  assert.equal(supplyTypeFor("27", "27"), "intra_state")
  assert.equal(supplyTypeFor("27", "29"), "inter_state")
})

test("amount in words uses Indian numbering", () => {
  assert.equal(amountInWords(87554), "Rupees Eighty Seven Thousand Five Hundred Fifty Four Only")
  assert.equal(amountInWords(188800), "Rupees One Lakh Eighty Eight Thousand Eight Hundred Only")
  assert.equal(amountInWords(12500000.5), "Rupees One Crore Twenty Five Lakh and Fifty Paise Only")
  assert.equal(amountInWords(0), "Rupees Zero Only")
})

test("INR formatting uses lakh grouping", () => {
  assert.equal(formatINR(123456.7), "₹1,23,456.70")
})
