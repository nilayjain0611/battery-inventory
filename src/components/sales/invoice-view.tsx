import { cn } from "cn"

import { formatAmount, formatINR, formatQty } from "@/lib/domain/money"
import type { InvoiceModel } from "@/lib/domain/invoice-model"
import { formatDate } from "@/lib/format"

/** On-screen invoice, rendered from the same model as the PDF. */
export function InvoiceView({ m }: { m: InvoiceModel }) {
  const inv = m.invoice
  return (
    <article className="rounded-lg border bg-card shadow-xs">
      {m.isDemo ? (
        <div className="rounded-t-lg border-b border-warning/40 bg-warning/10 px-5 py-2 text-xs text-[oklch(0.42_0.1_60)]">
          Demonstration invoice: company details and GST rates are unverified sample configuration. Not valid for statutory use.
        </div>
      ) : null}
      <header className="grid gap-6 border-b p-5 sm:grid-cols-2">
        <div>
          <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-dashed text-[10px] text-muted-foreground">
            LOGO
          </div>
          <p className="text-base font-semibold">{m.seller?.legal_name ?? "Seller details not captured"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{m.sellerAddress}</p>
          <p className="mt-1 text-sm">
            GSTIN <span className="font-mono">{m.seller?.gstin ?? "—"}</span>
          </p>
          {m.seller?.phone || m.seller?.email ? (
            <p className="text-xs text-muted-foreground">{[m.seller?.phone, m.seller?.email].filter(Boolean).join(" · ")}</p>
          ) : null}
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{m.title}</p>
          <p className="mt-1 font-mono text-lg font-semibold">{m.number}</p>
          <dl className="mt-2 space-y-0.5 text-sm">
            <div>
              <dt className="inline text-muted-foreground">Invoice date </dt>
              <dd className="inline">{formatDate(inv.invoice_date)}</dd>
            </div>
            {inv.due_date ? (
              <div>
                <dt className="inline text-muted-foreground">Due date </dt>
                <dd className="inline">{formatDate(inv.due_date)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="inline text-muted-foreground">Place of supply </dt>
              <dd className="inline">{m.placeOfSupply}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Supply </dt>
              <dd className="inline">{m.intra ? "Intra-state" : "Inter-state"}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="grid gap-6 border-b p-5 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Billed to</p>
          <p className="mt-1 font-medium">{m.buyer.name}</p>
          {m.buyer.billing ? <p className="text-muted-foreground whitespace-pre-line">{m.buyer.billing}</p> : null}
          <p className="mt-1">
            GSTIN <span className="font-mono">{m.buyer.gstin ?? "Unregistered"}</span>
          </p>
          {m.buyer.phone ? <p className="text-muted-foreground">{m.buyer.phone}</p> : null}
        </div>
        {m.buyer.shipping ? (
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Shipped to</p>
            <p className="mt-1 text-muted-foreground whitespace-pre-line">{m.buyer.shipping}</p>
          </div>
        ) : null}
      </section>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-muted/60 text-[11px] text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-left font-medium">HSN</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 text-right font-medium">Discount</th>
              <th className="px-3 py-2 text-right font-medium">Taxable</th>
              <th className="px-3 py-2 text-right font-medium">{m.intra ? "CGST + SGST" : "IGST"}</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {m.lines.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="px-3 py-2 text-muted-foreground">{l.line_no}</td>
                <td className="px-3 py-2">
                  <p className="font-medium">{l.product_name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{l.sku}</p>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{l.hsn_code ?? "—"}</td>
                <td className="tabular px-3 py-2 text-right">{formatQty(l.quantity, l.uom)}</td>
                <td className="tabular px-3 py-2 text-right">{formatAmount(l.unit_price)}</td>
                <td className="tabular px-3 py-2 text-right">{Number(l.discount_amount) > 0 ? formatAmount(l.discount_amount) : "—"}</td>
                <td className="tabular px-3 py-2 text-right">{formatAmount(l.taxable_value)}</td>
                <td className="tabular px-3 py-2 text-right">
                  {m.intra ? (
                    <>
                      {formatAmount(l.cgst_amount)} + {formatAmount(l.sgst_amount)}
                      <span className="block text-[11px] text-muted-foreground">
                        {Number(l.gst_rate) / 2}% + {Number(l.gst_rate) / 2}%
                      </span>
                    </>
                  ) : (
                    <>
                      {formatAmount(l.igst_amount)}
                      <span className="block text-[11px] text-muted-foreground">{l.gst_rate}%</span>
                    </>
                  )}
                </td>
                <td className="tabular px-3 py-2 text-right font-medium">{formatAmount(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {inv.prices_include_tax ? (
        <p className="px-5 pt-2 text-[11px] text-muted-foreground">Rates shown are inclusive of GST; taxable value is derived from them.</p>
      ) : null}

      <section className="grid gap-6 p-5 sm:grid-cols-[1fr_18rem]">
        <div className="space-y-3 text-sm">
          <table className="w-full max-w-md text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 text-left font-medium">GST rate</th>
                <th className="py-1 text-right font-medium">Taxable</th>
                {m.intra ? (
                  <>
                    <th className="py-1 text-right font-medium">CGST</th>
                    <th className="py-1 text-right font-medium">SGST</th>
                  </>
                ) : (
                  <th className="py-1 text-right font-medium">IGST</th>
                )}
              </tr>
            </thead>
            <tbody>
              {m.rateSummary.map((r) => (
                <tr key={r.rate} className="border-b last:border-0">
                  <td className="py-1">{r.rate}%</td>
                  <td className="tabular py-1 text-right">{formatAmount(r.taxable)}</td>
                  {m.intra ? (
                    <>
                      <td className="tabular py-1 text-right">{formatAmount(r.cgst)}</td>
                      <td className="tabular py-1 text-right">{formatAmount(r.sgst)}</td>
                    </>
                  ) : (
                    <td className="tabular py-1 text-right">{formatAmount(r.igst)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <span className="text-muted-foreground">Amount in words: </span>
            <span className="font-medium">{m.amountInWords}</span>
          </p>
          {inv.payment_terms ? (
            <p>
              <span className="text-muted-foreground">Payment terms: </span>
              {inv.payment_terms}
            </p>
          ) : null}
          {inv.notes ? <p className="text-muted-foreground whitespace-pre-line">{inv.notes}</p> : null}
          {m.seller?.bank_account_number ? (
            <p className="text-xs text-muted-foreground">
              Bank: {m.seller.bank_name} · A/c {m.seller.bank_account_number} · IFSC {m.seller.bank_ifsc}
            </p>
          ) : null}
        </div>
        <dl className="space-y-1.5 text-sm">
          <Line label="Taxable value" value={formatINR(inv.subtotal)} />
          {m.intra ? (
            <>
              <Line label="CGST" value={formatINR(inv.cgst_total)} />
              <Line label="SGST" value={formatINR(inv.sgst_total)} />
            </>
          ) : (
            <Line label="IGST" value={formatINR(inv.igst_total)} />
          )}
          {Number(inv.round_off) !== 0 ? <Line label="Round off" value={formatINR(inv.round_off)} /> : null}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Grand total</dt>
            <dd className="tabular">{formatINR(inv.grand_total)}</dd>
          </div>
          {inv.status === "posted" ? (
            <>
              <Line label="Received" value={formatINR(inv.amount_paid)} />
              <Line label="Balance due" value={formatINR(m.balanceDue)} strong={m.balanceDue.gt(0)} />
            </>
          ) : null}
        </dl>
      </section>
      <footer className="flex flex-col justify-between gap-4 border-t p-5 text-xs text-muted-foreground sm:flex-row">
        <p className="max-w-md whitespace-pre-line">{m.seller?.invoice_terms}</p>
        <div className="text-right">
          <p>For {m.seller?.legal_name}</p>
          <div className="mt-8 border-t pt-1">Authorised signatory</div>
        </div>
      </footer>
    </article>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "font-semibold text-destructive")}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  )
}
