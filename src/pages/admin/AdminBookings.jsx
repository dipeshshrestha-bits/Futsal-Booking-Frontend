import { useEffect, useMemo, useState } from 'react'
import DataTable from '../../components/DataTable.jsx'
import Modal from '../../components/Modal.jsx'
import { PageHeader } from '../../components/SidebarNav.jsx'
import StatusPill, { statusVariant } from '../../components/StatusPill.jsx'
import Pagination, { DateRangeFilter, SearchInput, rangeForPreset, usePagination } from '../../components/TableControls.jsx'
import {
  adminApi,
  formatDateTime,
  formatDay,
  formatNPR,
  formatTime,
  getErrorMessage,
  normalizeBooking,
  toList,
} from '../../services/api.js'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
]

const METHOD_OPTIONS = [
  { value: '', label: 'All methods' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Esewa', label: 'eSewa' },
]

const PAYMENT_OPTIONS = [
  { value: '', label: 'Any payment' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Unpaid', label: 'Unpaid' },
]

const methodLabel = (m) => (String(m).toLowerCase() === 'esewa' ? 'eSewa' : m || '—')
const isCancelled = (b) => String(b.status ?? '').toLowerCase().includes('cancel')

function Row({ label, children, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      <dd className={`min-w-0 text-right text-sm ${mono ? 'num' : 'font-medium'}`}>{children}</dd>
    </div>
  )
}

export default function AdminBookings() {
  const [range, setRange] = useState(() => rangeForPreset('30d'))
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [futsalId, setFutsalId] = useState('')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)

  /* Futsal list for the filter */
  const [futsals, setFutsals] = useState([])
  useEffect(() => {
    let active = true
    adminApi
      .futsals()
      .then((data) => {
        if (active) setFutsals(toList(data))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  /* Bookings */
  const [reload, setReload] = useState(0)
  const apiParams = useMemo(() => {
    const params = {}
    if (range.from) params.from = range.from
    if (range.to) params.to = range.to
    if (status) params.status = status
    if (method) params.paymentMethod = method
    if (paymentStatus) params.paymentStatus = paymentStatus
    if (futsalId) params.futsalId = futsalId
    return params
  }, [range, status, method, paymentStatus, futsalId])

  const requestKey = `${JSON.stringify(apiParams)}#${reload}`
  const [result, setResult] = useState({ key: null, items: [], error: null })
  const loading = result.key !== requestKey

  useEffect(() => {
    let active = true
    adminApi
      .bookings(apiParams)
      .then((data) => {
        if (active) setResult({ key: requestKey, items: toList(data).map(normalizeBooking).filter(Boolean), error: null })
      })
      .catch((err) => {
        if (active) setResult({ key: requestKey, items: [], error: getErrorMessage(err, 'Could not load bookings.') })
      })
    return () => {
      active = false
    }
  }, [apiParams, requestKey])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return result.items
      .filter(
        (b) =>
          !q ||
          [b.referenceCode, b.playerName, b.contactNumber, b.futsalName].some((v) => String(v ?? '').toLowerCase().includes(q))
      )
      .sort(
        (a, b) =>
          String(b.date).localeCompare(String(a.date)) || formatTime(b.startTime).localeCompare(formatTime(a.startTime))
      )
  }, [result.items, search])

  const totals = useMemo(() => {
    const live = rows.filter((b) => !isCancelled(b))
    return {
      count: live.length,
      value: live.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
      paid: live
        .filter((b) => statusVariant(b.paymentStatus) === 'success')
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
      cancelled: rows.length - live.length,
    }
  }, [rows])

  const pager = usePagination(rows, 20, `${requestKey}|${search}`)

  const columns = [
    { key: 'ref', header: 'Ref', mono: true, render: (b) => b.referenceCode || '—' },
    {
      key: 'when',
      header: 'When',
      render: (b) => (
        <div>
          <p className="num text-sm">
            {formatTime(b.startTime)}–{formatTime(b.endTime)}
          </p>
          <p className="num text-xs text-muted">{formatDay(b.date)}</p>
        </div>
      ),
    },
    {
      key: 'venue',
      header: 'Venue',
      render: (b) => (
        <div>
          <p className="font-medium">{b.futsalName || '—'}</p>
          {b.courtName && <p className="text-xs text-muted">{b.courtName}</p>}
        </div>
      ),
    },
    {
      key: 'player',
      header: 'Player',
      hideBelow: 'md',
      render: (b) => (
        <div>
          <p>{b.playerName || '—'}</p>
          <p className="num text-xs text-muted">{b.contactNumber || '—'}</p>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (b) => formatNPR(b.amount) },
    {
      key: 'payment',
      header: 'Payment',
      hideBelow: 'lg',
      render: (b) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill status={b.paymentStatus || 'Unpaid'} />
          <span className="text-xs text-muted">{methodLabel(b.paymentMethod)}</span>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (b) => <StatusPill status={b.status} /> },
  ]

  const clearFilters = () => {
    setStatus('')
    setMethod('')
    setPaymentStatus('')
    setFutsalId('')
    setSearch('')
  }

  const hasExtraFilters = Boolean(status || method || paymentStatus || futsalId || search)

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Bookings"
        description="Every booking across all venues. Click a row for full details."
      />

      {/* Filters */}
      <div className="mb-4 space-y-3 rounded-2xl border bg-surface p-3 sm:p-4">
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Futsal" value={futsalId} onChange={(e) => setFutsalId(e.target.value)} className="input h-10 w-auto py-0 text-sm">
            <option value="">All futsals</option>
            {futsals.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.name}
              </option>
            ))}
          </select>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="input h-10 w-auto py-0 text-sm">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)} className="input h-10 w-auto py-0 text-sm">
            {METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Payment status"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="input h-10 w-auto py-0 text-sm"
          >
            {PAYMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {hasExtraFilters && (
            <button type="button" onClick={clearFilters} className="px-2 text-sm font-medium text-muted underline underline-offset-2 hover:text-ink">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 divide-hairline rounded-2xl border bg-surface sm:grid-cols-4 sm:divide-x">
        <div className="px-4 py-3">
          <p className="eyebrow">Bookings</p>
          <p className="num mt-1 text-lg font-medium">{loading ? '—' : totals.count}</p>
        </div>
        <div className="px-4 py-3">
          <p className="eyebrow">Booking value</p>
          <p className="num mt-1 text-lg font-medium">{loading ? '—' : formatNPR(totals.value)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="eyebrow">Paid</p>
          <p className="num mt-1 text-lg font-medium text-success-text">{loading ? '—' : formatNPR(totals.paid)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="eyebrow">Cancelled</p>
          <p className="num mt-1 text-lg font-medium text-danger-text">{loading ? '—' : totals.cancelled}</p>
        </div>
      </div>

      <DataTable
        toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Reference, player, phone or venue" className="sm:w-80" />}
        footer={!loading && !result.error && rows.length > 0 ? <Pagination {...pager} onPageChange={pager.setPage} /> : null}
        columns={columns}
        data={pager.pageItems}
        loading={loading}
        error={result.error}
        onRetry={() => setReload((n) => n + 1)}
        onRowClick={setDetail}
        rowKey={(b, i) => b.id ?? b.referenceCode ?? i}
        emptyMessage="No bookings match these filters."
        minWidth={860}
      />

      {detail && (
        <Modal open onClose={() => setDetail(null)} title="Booking details" description={detail.referenceCode} size="md">
          <div className="flex flex-wrap gap-1.5">
            <StatusPill status={detail.status} />
            <StatusPill status={detail.paymentStatus || 'Unpaid'} />
          </div>
          <dl className="mt-3 divide-y divide-hairline border-t">
            <Row label="Reference" mono>{detail.referenceCode || '—'}</Row>
            <Row label="Venue">{detail.futsalName || '—'}</Row>
            <Row label="Court">{detail.courtName || '—'}</Row>
            <Row label="Date" mono>{formatDay(detail.date)}</Row>
            <Row label="Time" mono>
              {formatTime(detail.startTime)} – {formatTime(detail.endTime)}
            </Row>
            <Row label="Player">{detail.playerName || '—'}</Row>
            <Row label="Mobile" mono>{detail.contactNumber || '—'}</Row>
            <Row label="Email">{detail.email || '—'}</Row>
            <Row label="Amount" mono>{formatNPR(detail.amount)}</Row>
            <Row label="Payment method">{methodLabel(detail.paymentMethod)}</Row>
            <Row label="Booked at" mono>{formatDateTime(detail.createdAt)}</Row>
          </dl>
        </Modal>
      )}
    </>
  )
}