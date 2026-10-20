import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"

import { formatAmount, formatQty } from "@/lib/domain/money"
import type { InvoiceModel } from "@/lib/domain/invoice-model"
import { formatDate } from "@/lib/format"

// The built-in PDF fonts have no rupee glyph, so amounts are labelled "INR".
const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1f2430" },
  banner: { backgroundColor: "#fff4dc", borderColor: "#e6b84a", borderWidth: 0.75, padding: 6, marginBottom: 10, fontSize: 8, color: "#6b4a00" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  logo: { width: 44, height: 44, borderWidth: 0.75, borderStyle: "dashed", borderColor: "#9aa0ad", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  muted: { color: "#5c6372" },
  bold: { fontFamily: "Helvetica-Bold" },
  h1: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 8, letterSpacing: 2, color: "#5c6372", fontFamily: "Helvetica-Bold", textAlign: "right" },
  number: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right", marginTop: 2 },
  box: { borderWidth: 0.75, borderColor: "#d5d9e0", padding: 8 },
  label: { fontSize: 7, color: "#5c6372", fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 3 },
  th: { backgroundColor: "#eef1f5", fontFamily: "Helvetica-Bold", fontSize: 7.5, paddingVertical: 4, paddingHorizontal: 3, color: "#3b4252" },
  td: { paddingVertical: 4, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: "#e2e5ea" },
  right: { textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#1f2430", paddingTop: 4, marginTop: 3, fontSize: 11, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#7a8190", textAlign: "center" },
})

const COLS = [
  { key: "no", label: "#", w: "4%" },
  { key: "item", label: "Item", w: "26%" },
  { key: "hsn", label: "HSN", w: "8%" },
  { key: "qty", label: "Qty", w: "8%", right: true },
  { key: "rate", label: "Rate", w: "10%", right: true },
  { key: "disc", label: "Disc.", w: "8%", right: true },
  { key: "taxable", label: "Taxable", w: "11%", right: true },
  { key: "tax", label: "GST", w: "13%", right: true },
  { key: "amount", label: "Amount", w: "12%", right: true },
] as const

export function InvoicePdf({ m }: { m: InvoiceModel }) {
  const inv = m.invoice
  return (
    <Document title={`Invoice ${m.number}`} author={m.seller?.legal_name ?? undefined} creator="Voltaxis ERP">
      <Page size="A4" style={s.page}>
        {m.isDemo ? (
          <Text style={s.banner}>
            DEMONSTRATION INVOICE - company details and GST rates are unverified sample configuration. Not valid for statutory use.
          </Text>
        ) : null}
        {m.status !== "posted" ? (
          <Text style={[s.banner, { backgroundColor: "#fde8e8", borderColor: "#d64545", color: "#8a1c1c" }]}>
            {m.status === "draft" ? "DRAFT - not posted, no invoice number allocated." : "CANCELLED INVOICE"}
          </Text>
        ) : null}

        <View style={s.between}>
          <View style={{ width: "58%" }}>
            <View style={s.logo}>
              <Text style={{ fontSize: 6, color: "#9aa0ad" }}>LOGO</Text>
            </View>
            <Text style={s.h1}>{m.seller?.legal_name ?? ""}</Text>
            <Text style={[s.muted, { marginTop: 2 }]}>{m.sellerAddress}</Text>
            <Text style={{ marginTop: 2 }}>GSTIN: {m.seller?.gstin ?? "-"}</Text>
            <Text style={s.muted}>{[m.seller?.phone, m.seller?.email].filter(Boolean).join("  |  ")}</Text>
          </View>
          <View style={{ width: "40%" }}>
            <Text style={s.title}>{m.title}</Text>
            <Text style={s.number}>{m.number}</Text>
            <Text style={[s.right, { marginTop: 4 }]}>Invoice date: {formatDate(inv.invoice_date)}</Text>
            {inv.due_date ? <Text style={s.right}>Due date: {formatDate(inv.due_date)}</Text> : null}
            <Text style={s.right}>Place of supply: {m.placeOfSupply}</Text>
            <Text style={s.right}>{m.intra ? "Intra-state supply" : "Inter-state supply"}</Text>
          </View>
        </View>

        <View style={[s.row, { marginTop: 12, gap: 8 }]}>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.label}>Billed to</Text>
            <Text style={s.bold}>{m.buyer.name}</Text>
            {m.buyer.billing ? <Text style={s.muted}>{m.buyer.billing}</Text> : null}
            <Text style={{ marginTop: 2 }}>GSTIN: {m.buyer.gstin ?? "Unregistered"}</Text>
            {m.buyer.phone ? <Text style={s.muted}>{m.buyer.phone}</Text> : null}
          </View>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.label}>Shipped to</Text>
            <Text style={s.muted}>{m.buyer.shipping ?? m.buyer.billing ?? "Same as billing"}</Text>
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <View style={s.row}>
            {COLS.map((c) => (
              <Text key={c.key} style={[s.th, { width: c.w }, "right" in c && c.right ? s.right : {}]}>
                {c.label}
              </Text>
            ))}
          </View>
          {m.lines.map((l) => (
            <View key={l.id} style={s.row} wrap={false}>
              <Text style={[s.td, { width: COLS[0].w }]}>{l.line_no}</Text>
              <View style={[s.td, { width: COLS[1].w }]}>
                <Text style={s.bold}>{l.product_name}</Text>
                <Text style={[s.muted, { fontSize: 7 }]}>{l.sku}</Text>
              </View>
              <Text style={[s.td, { width: COLS[2].w }]}>{l.hsn_code ?? "-"}</Text>
              <Text style={[s.td, s.right, { width: COLS[3].w }]}>{formatQty(l.quantity, l.uom)}</Text>
              <Text style={[s.td, s.right, { width: COLS[4].w }]}>{formatAmount(l.unit_price)}</Text>
              <Text style={[s.td, s.right, { width: COLS[5].w }]}>{Number(l.discount_amount) > 0 ? formatAmount(l.discount_amount) : "-"}</Text>
              <Text style={[s.td, s.right, { width: COLS[6].w }]}>{formatAmount(l.taxable_value)}</Text>
              <View style={[s.td, { width: COLS[7].w }]}>
                <Text style={s.right}>
                  {m.intra ? `${formatAmount(l.cgst_amount)}+${formatAmount(l.sgst_amount)}` : formatAmount(l.igst_amount)}
                </Text>
                <Text style={[s.right, s.muted, { fontSize: 6.5 }]}>
                  {m.intra ? `CGST ${Number(l.gst_rate) / 2}% + SGST ${Number(l.gst_rate) / 2}%` : `IGST ${l.gst_rate}%`}
                </Text>
              </View>
              <Text style={[s.td, s.right, s.bold, { width: COLS[8].w }]}>{formatAmount(l.line_total)}</Text>
            </View>
          ))}
        </View>
        {inv.prices_include_tax ? (
          <Text style={[s.muted, { fontSize: 7, marginTop: 3 }]}>Rates are inclusive of GST; taxable value is derived from them.</Text>
        ) : null}

        <View style={[s.between, { marginTop: 12 }]} wrap={false}>
          <View style={{ width: "56%" }}>
            <View style={s.row}>
              <Text style={[s.th, { width: "25%" }]}>Rate</Text>
              <Text style={[s.th, s.right, { width: "25%" }]}>Taxable</Text>
              {m.intra ? (
                <>
                  <Text style={[s.th, s.right, { width: "25%" }]}>CGST</Text>
                  <Text style={[s.th, s.right, { width: "25%" }]}>SGST</Text>
                </>
              ) : (
                <Text style={[s.th, s.right, { width: "50%" }]}>IGST</Text>
              )}
            </View>
            {m.rateSummary.map((r) => (
              <View key={r.rate} style={s.row}>
                <Text style={[s.td, { width: "25%" }]}>{r.rate}%</Text>
                <Text style={[s.td, s.right, { width: "25%" }]}>{formatAmount(r.taxable)}</Text>
                {m.intra ? (
                  <>
                    <Text style={[s.td, s.right, { width: "25%" }]}>{formatAmount(r.cgst)}</Text>
                    <Text style={[s.td, s.right, { width: "25%" }]}>{formatAmount(r.sgst)}</Text>
                  </>
                ) : (
                  <Text style={[s.td, s.right, { width: "50%" }]}>{formatAmount(r.igst)}</Text>
                )}
              </View>
            ))}
            <Text style={{ marginTop: 8 }}>
              <Text style={s.muted}>Amount in words: </Text>
              <Text style={s.bold}>{m.amountInWords}</Text>
            </Text>
            {inv.payment_terms ? <Text style={{ marginTop: 4 }}>Payment terms: {inv.payment_terms}</Text> : null}
            {inv.notes ? <Text style={[s.muted, { marginTop: 4 }]}>{inv.notes}</Text> : null}
            {m.seller?.bank_account_number ? (
              <Text style={[s.muted, { marginTop: 6 }]}>
                Bank: {m.seller.bank_name}  |  A/c {m.seller.bank_account_number}  |  IFSC {m.seller.bank_ifsc}
              </Text>
            ) : null}
          </View>
          <View style={{ width: "38%" }}>
            <View style={s.totalRow}>
              <Text style={s.muted}>Taxable value</Text>
              <Text>{formatAmount(inv.subtotal)}</Text>
            </View>
            {m.intra ? (
              <>
                <View style={s.totalRow}>
                  <Text style={s.muted}>CGST</Text>
                  <Text>{formatAmount(inv.cgst_total)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.muted}>SGST</Text>
                  <Text>{formatAmount(inv.sgst_total)}</Text>
                </View>
              </>
            ) : (
              <View style={s.totalRow}>
                <Text style={s.muted}>IGST</Text>
                <Text>{formatAmount(inv.igst_total)}</Text>
              </View>
            )}
            {Number(inv.round_off) !== 0 ? (
              <View style={s.totalRow}>
                <Text style={s.muted}>Round off</Text>
                <Text>{formatAmount(inv.round_off)}</Text>
              </View>
            ) : null}
            <View style={s.grand}>
              <Text>Total (INR)</Text>
              <Text>{formatAmount(inv.grand_total)}</Text>
            </View>
            {inv.status === "posted" ? (
              <>
                <View style={[s.totalRow, { marginTop: 4 }]}>
                  <Text style={s.muted}>Received</Text>
                  <Text>{formatAmount(inv.amount_paid)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.bold}>Balance due</Text>
                  <Text style={s.bold}>{formatAmount(m.balanceDue)}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={[s.between, { marginTop: 24 }]} wrap={false}>
          <Text style={[s.muted, { width: "55%", fontSize: 7.5 }]}>{m.seller?.invoice_terms ?? ""}</Text>
          <View style={{ width: "35%", alignItems: "flex-end" }}>
            <Text>For {m.seller?.legal_name ?? ""}</Text>
            <Text style={{ marginTop: 34, borderTopWidth: 0.75, borderTopColor: "#1f2430", paddingTop: 3, width: "100%", textAlign: "right" }}>
              Authorised signatory
            </Text>
          </View>
        </View>

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${m.seller?.invoice_footer ?? "Computer-generated invoice."}   |   ${m.number}   |   Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  )
}
