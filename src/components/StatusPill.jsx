const STYLES = {
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
  info: 'bg-info-bg text-info-text',
  neutral: 'bg-ink/[0.06] text-muted',
}

const DOTS = {
  success: 'bg-success-text',
  warning: 'bg-warning-text',
  danger: 'bg-danger-text',
  info: 'bg-info-text',
  neutral: 'bg-faint',
}

// Order matters: "inactive" is checked before "active", "unpaid" before "paid"
const KEYWORDS = [
  ['danger', ['cancel', 'fail', 'refund', 'reject', 'inactive', 'deactiv', 'mismatch', 'expired', 'error', 'noshow', 'no show']],
  ['warning', ['pending', 'unpaid', 'hold', 'process', 'await', 'initiated']],
  ['success', ['confirm', 'paid', 'complete', 'success', 'active', 'live', 'ready', 'available', 'approved']],
  ['info', ['esewa', 'online', 'phone', 'manual', 'blocked', 'info']],
]

// eslint-disable-next-line react-refresh/only-export-components
export function statusVariant(status) {
  const s = String(status ?? '').toLowerCase()
  if (!s) return 'neutral'
  for (const [variant, words] of KEYWORDS) {
    if (words.some((w) => s.includes(w))) return variant
  }
  return 'neutral'
}

function toLabel(status) {
  return String(status ?? '—')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
}

export default function StatusPill({ status, variant, dot = true, className = '', children }) {
  const v = variant ?? statusVariant(status)

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-[3px] font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.08em] ${STYLES[v] ?? STYLES.neutral} ${className}`}
    >
      {dot && (
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOTS[v] ?? DOTS.neutral}`} />
      )}
      {children ?? toLabel(status)}
    </span>
  )
}
