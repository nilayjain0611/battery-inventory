import { renderToBuffer } from "@react-pdf/renderer"

import { InvoicePdf } from "@/components/pdf/invoice-pdf"
import { getInvoice } from "@/lib/data/sales"
import { buildInvoiceModel } from "@/lib/domain/invoice-model"
import { id as idSchema } from "@/lib/domain/schemas"
import { createClient } from "@/lib/supabase/server"

/**
 * Server-side PDF of a persisted invoice. Data is read with the caller's
 * session, so row-level security decides whether they may see it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!idSchema.safeParse(id).success) return new Response("Not found", { status: 404 })

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) return new Response("Sign in required", { status: 401 })

  const detail = await getInvoice(id)
  if (!detail) return new Response("Not found", { status: 404 })

  const model = buildInvoiceModel(detail)
  // Call the component directly so the root element is the <Document> renderToBuffer expects.
  const buffer = await renderToBuffer(InvoicePdf({ m: model }))
  const fileName = `${model.number.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`
  const download = new URL(request.url).searchParams.get("download") === "1"

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
