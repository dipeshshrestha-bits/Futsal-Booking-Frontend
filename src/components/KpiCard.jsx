import { formatNPR, formatNumber } from '../services/api'

export default function KpiCard({
  label,
  value,
  format = 'number', // 'number' | 'currency' | 'none'
  hint,
  delta,
  deva,
  icon,
  loading = false,
  className = '',
}) {
  let display = '—'
  if (value !== null && value !== undefined) {
    if (format === 'currency') display = formatNPR(value)
    else if (format === 'number') display = formatNumber(value)
    else display = value
  }

  const d = Number(delta)
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(d)

  return (
    <div className={`rounded-2xl border bg-surface p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow truncate">{label}</p>
          {deva && <p className="deva mt-0.5 truncate text-xs">{deva}</p>}
        </div>
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/[0.05] text-muted">
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <div className="skeleton mt-4 h-8 w-28" />
      ) : (
        <p className="num mt-3 truncate text-[28px] font-medium leading-none tracking-tight text-ink">
          {display}
        </p>
      )}

      {!loading && (hasDelta || hint) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {hasDelta && (
            <span
              className={`num inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${
                d >= 0 ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'
              }`}
            >
              {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-muted">{hint}</span>}
        </div>
      )}
    </div>
  )
}