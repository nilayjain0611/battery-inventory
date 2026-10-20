import { formatINR, formatINRCompact } from "@/lib/domain/money"
import { formatDate } from "@/lib/format"

/** Daily sales bar chart (server-rendered SVG, values from the database). */
export function SalesChart({ data }: { data: { date: string; total: number }[] }) {
  const width = 720
  const height = 200
  const pad = { top: 12, right: 8, bottom: 22, left: 52 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(1, ...data.map((d) => Number(d.total)))
  const niceMax = niceCeil(max)
  const bw = innerW / Math.max(1, data.length)
  const ticks = [0, niceMax / 2, niceMax]

  if (data.every((d) => Number(d.total) === 0)) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No posted sales in the last 30 days.</p>
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Daily sales for the last 30 days">
      {ticks.map((t) => {
        const y = pad.top + innerH - (t / niceMax) * innerH
        return (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="stroke-border" strokeDasharray={t === 0 ? undefined : "3 3"} />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {formatINRCompact(t)}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const v = Number(d.total)
        const h = (v / niceMax) * innerH
        const x = pad.left + i * bw + bw * 0.18
        const y = pad.top + innerH - h
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={bw * 0.64} height={Math.max(h, v > 0 ? 1.5 : 0)} rx={2} className="fill-primary/85">
              <title>{`${formatDate(d.date)}: ${formatINR(v)}`}</title>
            </rect>
            {i % 5 === 0 || i === data.length - 1 ? (
              <text x={x + bw * 0.32} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {formatDate(d.date).slice(0, 6)}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function niceCeil(v: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nice * exp
}
