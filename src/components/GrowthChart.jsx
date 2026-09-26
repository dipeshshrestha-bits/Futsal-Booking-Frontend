import { useId, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNPR, formatNumber, toList } from '../services/api.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const DEFAULT_SERIES = [
  { key: 'revenue', aliases: ['totalRevenue', 'amount'], label: 'Revenue', format: 'currency' },
  { key: 'bookings', aliases: ['bookingCount', 'totalBookings', 'count'], label: 'Bookings', format: 'number' },
]

const TICK = { fontFamily: '"DM Mono", ui-monospace, monospace', fontSize: 11, fill: '#9A958C' }

/** "2026-09-14" → "14 Sep", "2026-09" → "Sep 26", anything else unchanged */
function formatChartLabel(value) {
  const str = String(value ?? '')
  let match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]} ${MONTHS[Number(match[2]) - 1]}`
  match = str.match(/^(\d{4})-(\d{2})$/)
  if (match) return `${MONTHS[Number(match[2]) - 1]} ${match[1].slice(2)}`
  return str
}

function compactNumber(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${+(n / 10000000).toFixed(1)}Cr`
  if (abs >= 100000) return `${+(n / 100000).toFixed(1)}L`
  if (abs >= 1000) return `${+(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatValue(value, format) {
  return format === 'currency' ? formatNPR(value) : formatNumber(value)
}

function ChartTooltip({ active, payload, label, series }) {
  if (!active || !payload?.length || !series) return null
  return (
    <div className="rounded-xl border bg-surface px-3 py-2 shadow-float">
      <p className="font-mono text-[10.5px] tracking-[0.1em] text-muted uppercase">{label}</p>
      <p className="num mt-0.5 text-sm font-medium text-ink">{formatValue(payload[0].value, series.format)}</p>
      <p className="text-xs text-muted">{series.label}</p>
    </div>
  )
}

export default function GrowthChart({
  data,
  series = DEFAULT_SERIES,
  labelKey,
  title = 'Growth',
  eyebrow = 'Trend',
  color = '#D9411E',
  height = 260,
  loading = false,
  emptyMessage = 'Not enough data to show a trend yet.',
  className = '',
}) {
  const rawId = useId()
  const gradientId = `growth-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const [activeKey, setActiveKey] = useState(series[0]?.key)
  const current = series.find((s) => s.key === activeKey) ?? series[0]

  const rows = useMemo(
    () =>
      toList(data).map((item) => {
        const rawLabel = labelKey
          ? item?.[labelKey]
          : (item?.label ?? item?.period ?? item?.month ?? item?.date ?? item?.name)
        const row = { label: formatChartLabel(rawLabel) }
        series.forEach((s) => {
          const source = [s.key, ...(s.aliases ?? [])].find(
            (k) => item?.[k] !== undefined && item?.[k] !== null
          )
          const n = Number(source ? item[source] : 0)
          row[s.key] = Number.isFinite(n) ? n : 0
        })
        return row
      }),
    [data, labelKey, series]
  )

  const total = current ? rows.reduce((sum, r) => sum + (r[current.key] ?? 0), 0) : 0
  const hasData = current ? rows.some((r) => r[current.key] > 0) : false

  return (
    <div className={`flex flex-col rounded-2xl border bg-surface ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h3 className="mt-0.5 text-base font-semibold">{title}</h3>
        </div>

        {series.length > 1 && (
          <div role="tablist" className="flex rounded-xl bg-ink/[0.05] p-1">
            {series.map((s) => {
              const active = s.key === current?.key
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveKey(s.key)}
                  className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                    active ? 'bg-surface text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1 px-3 pt-4 pb-3 sm:px-4">
        {loading ? (
          <div className="px-2">
            <div className="skeleton h-7 w-32" />
            <div className="skeleton mt-4 w-full rounded-xl" style={{ height }} />
          </div>
        ) : !hasData ? (
          <div
            className="flex flex-col items-center justify-center rounded-xl bg-ink/[0.03] px-4 text-center"
            style={{ height: height + 44 }}
          >
            <div aria-hidden="true" className="stripes h-12 w-12 rounded-full border" />
            <p className="mt-3 text-sm text-muted">{emptyMessage}</p>
          </div>
        ) : (
          <>
            <div className="px-2">
              <p className="num text-2xl leading-none font-medium">{formatValue(total, current.format)}</p>
              <p className="mt-1 text-xs text-muted">Total {current.label.toLowerCase()} in this period</p>
            </div>
            <div className="mt-3" style={{ height }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.16} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(18,17,15,0.07)" />
                  <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                  <YAxis
                    tick={TICK}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    allowDecimals={false}
                    tickFormatter={compactNumber}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgba(18,17,15,0.15)' }}
                    content={(props) => <ChartTooltip {...props} series={current} />}
                  />
                  <Area
                    type="monotone"
                    dataKey={current.key}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: color }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
