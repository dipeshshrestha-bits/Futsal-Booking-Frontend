import { useCallback, useMemo, useState } from 'react'
import Button from './Button.jsx'
import { Icon } from './SidebarNav.jsx'
import { toDateInputValue } from '../services/api.js'

/* ---------------- Pagination ---------------- */

/** Client-side paging. Goes back to page 1 whenever resetKey changes (e.g. filters). */
export function usePagination(items, pageSize = 20, resetKey = '') {
  const [state, setState] = useState({ key: resetKey, page: 1 })
  const requested = state.key === resetKey ? state.page : 1
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(requested, pageCount)

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  )

  const setPage = useCallback((next) => setState({ key: resetKey, page: next }), [resetKey])

  return { page, pageCount, pageItems, setPage, total: items.length, pageSize }
}

export default function Pagination({ page, pageCount, total, pageSize, onPageChange }) {
  if (!total) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Showing <span className="num text-ink">{start}–{end}</span> of <span className="num text-ink">{total}</span>
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1.5">
          <Button variant="soft" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <Icon name="chevronLeft" className="h-4 w-4" />
          </Button>
          <span className="num px-2 text-sm">
            {page} / {pageCount}
          </span>
          <Button variant="soft" size="icon" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            <Icon name="chevronRight" className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/* ---------------- Search ---------------- */

export function SearchInput({ value, onChange, placeholder = 'Search', className = '' }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{placeholder}</span>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input h-10 py-0 pl-9 text-sm"
      />
    </label>
  )
}

/* ---------------- Filter chip ---------------- */

export function FilterChip({ active, onClick, count, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors ${
        active ? 'border-ink bg-ink text-white' : 'border-hairline-strong bg-surface hover:border-ink/40'
      }`}
    >
      {children}
      {count !== undefined && <span className="num opacity-70">{count}</span>}
    </button>
  )
}

/* ---------------- Date range ---------------- */

const PRESETS = [
  { value: 'today', label: 'Today', days: 0 },
  { value: '7d', label: '7 days', days: 6 },
  { value: '30d', label: '30 days', days: 29 },
  { value: 'all', label: 'All time', days: null },
]

export function rangeForPreset(value) {
  const preset = PRESETS.find((p) => p.value === value)
  if (!preset || preset.days === null) return { from: '', to: '' }
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - preset.days)
  return { from: toDateInputValue(start), to: toDateInputValue(now) }
}

export function DateRangeFilter({ from, to, onChange }) {
  const activePreset = PRESETS.find((p) => {
    const r = rangeForPreset(p.value)
    return r.from === from && r.to === to
  })?.value

  // Swap automatically if "from" ends up after "to"
  const update = (next) => {
    if (next.from && next.to && next.from > next.to) onChange({ from: next.to, to: next.from })
    else onChange(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="Date presets" className="flex rounded-xl bg-ink/[0.05] p-1">
        {PRESETS.map((p) => {
          const active = activePreset === p.value
          return (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(rangeForPreset(p.value))}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-surface text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          aria-label="From date"
          value={from}
          onChange={(e) => update({ from: e.target.value, to })}
          className="input num h-10 w-auto py-0 text-sm"
        />
        <span className="text-faint">–</span>
        <input
          type="date"
          aria-label="To date"
          value={to}
          onChange={(e) => update({ from, to: e.target.value })}
          className="input num h-10 w-auto py-0 text-sm"
        />
      </div>
    </div>
  )
}