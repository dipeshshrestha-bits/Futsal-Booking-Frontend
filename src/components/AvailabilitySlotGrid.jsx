import { formatNPR, formatTime, toDateInputValue } from '../services/api'

// These slot helpers are colocated with the grid because they define its input
// contract and are also used by the booking flow.
// eslint-disable-next-line react-refresh/only-export-components
export function getSlotStart(slot) {
  return slot?.startTime ?? slot?.start ?? slot?.from ?? ''
}

// eslint-disable-next-line react-refresh/only-export-components
export function getSlotEnd(slot) {
  return slot?.endTime ?? slot?.end ?? slot?.to ?? ''
}

// eslint-disable-next-line react-refresh/only-export-components
export function getSlotKey(slot) {
  return `${formatTime(getSlotStart(slot))}-${formatTime(getSlotEnd(slot))}`
}

/** Normalizes backend slot shapes to: available | booked | blocked | past */
// eslint-disable-next-line react-refresh/only-export-components
export function getSlotStatus(slot, date) {
  const raw = String(slot?.status ?? '').toLowerCase()
  let status = 'available'

  if (raw) {
    if (raw.includes('block') || raw.includes('mainten')) status = 'blocked'
    else if (raw.includes('book') || raw.includes('reserv') || raw.includes('unavail') || raw.includes('taken'))
      status = 'booked'
  } else if (slot?.isBlocked) {
    status = 'blocked'
  } else if (slot?.isBooked || slot?.isAvailable === false) {
    status = 'booked'
  }

  // Slots that already started today can't be booked
  if (status === 'available' && date && date === toDateInputValue()) {
    const [h, m] = formatTime(getSlotStart(slot)).split(':').map(Number)
    const now = new Date()
    if (Number.isFinite(h) && Number.isFinite(m) && h * 60 + m <= now.getHours() * 60 + now.getMinutes()) {
      status = 'past'
    }
  }

  return status
}

const STYLES = {
  available: 'border-hairline-strong bg-surface text-ink hover:border-ink/40',
  selected: 'border-ink bg-ink text-white',
  booked: 'border-transparent bg-ink/[0.04] text-faint',
  blocked: 'stripes border-transparent text-faint',
  past: 'border-transparent bg-ink/[0.03] text-faint/70',
}

const LABELS = {
  booked: 'Booked',
  blocked: 'Blocked',
  past: 'Past',
}

function LegendItem({ className, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  )
}

export default function AvailabilitySlotGrid({
  slots = [],
  date,
  selectedKey,
  onSelect,
  loading = false,
  error = null,
  onRetry,
  showPrice = true,
  selectable = ['available'],
  emptyMessage = 'No slots for this date.',
  showLegend = true,
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-[74px] rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">
        <p>{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-1 font-medium underline underline-offset-2">
            Try again
          </button>
        )}
      </div>
    )
  }

  if (!slots.length) {
    return (
      <p className="rounded-xl bg-ink/[0.04] px-4 py-6 text-center text-sm text-muted">{emptyMessage}</p>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((slot) => {
          const key = getSlotKey(slot)
          const status = getSlotStatus(slot, date)
          const isSelected = selectedKey === key
          const canSelect = Boolean(onSelect) && selectable.includes(status)
          const price = slot?.price ?? slot?.pricePerHour

          return (
            <button
              key={key}
              type="button"
              disabled={!canSelect}
              aria-pressed={isSelected}
              onClick={() => onSelect?.(slot)}
              className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors ${
                onSelect ? 'disabled:cursor-not-allowed' : 'cursor-default'
              } ${isSelected ? STYLES.selected : STYLES[status]}`}
            >
              <span className={`num text-[15px] font-medium leading-5 ${status === 'booked' ? 'line-through' : ''}`}>
                {formatTime(getSlotStart(slot))}
              </span>
              <span className={`num text-[11px] leading-4 ${isSelected ? 'text-white/70' : 'text-muted'}`}>
                – {formatTime(getSlotEnd(slot))}
              </span>
              <span className="mt-1.5 font-mono text-[10px] uppercase tracking-wider">
                {status === 'available'
                  ? showPrice && price != null
                    ? formatNPR(price)
                    : 'Open'
                  : LABELS[status]}
              </span>
            </button>
          )
        })}
      </div>

      {showLegend && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
          <LegendItem className="border border-hairline-strong bg-surface" label="Open" />
          <LegendItem className="bg-ink" label="Selected" />
          <LegendItem className="bg-ink/10" label="Booked" />
          <LegendItem className="stripes border" label="Blocked" />
        </div>
      )}
    </div>
  )
}
