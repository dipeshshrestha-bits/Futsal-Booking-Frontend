import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import DataTable from '../../components/DataTable.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon, PageHeader } from '../../components/SidebarNav.jsx'
import StatusPill, { statusVariant } from '../../components/StatusPill.jsx'
import { useToast } from '../../components/Toast.jsx'
import {
  asId,
  formatDay,
  formatNPR,
  formatTime,
  getErrorMessage,
  isValidNepalPhone,
  normalizeBooking,
  normalizePhone,
  ownerApi,
  toDateInputValue,
  toList,
} from '../../services/api.js'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
]

const DANGER_SOFT =
  'inline-flex h-9 items-center justify-center rounded-xl bg-danger-bg px-3.5 text-sm font-medium text-danger-text transition-colors hover:bg-[#F6DCD3] disabled:cursor-not-allowed disabled:opacity-50'

function parseLocalDate(value) {
  const [y, m, d] = String(value).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function shiftDate(value, days) {
  const d = parseLocalDate(value)
  d.setDate(d.getDate() + days)
  return toDateInputValue(d)
}

function toMinutes(time) {
  const [h, m] = formatTime(time).split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN
}

function toOwnerBooking(raw) {
  const booking = normalizeBooking(raw)
  if (!booking) return null
  const src = raw.booking ?? raw
  return {
    ...booking,
    courtId: src.courtId ?? src.court?.id,
    source: src.source ?? src.bookingSource ?? (src.isManual ? 'Manual' : ''),
  }
}

const isCancelled = (b) => String(b?.status ?? '').toLowerCase().includes('cancel')
const isPaid = (b) => statusVariant(b?.paymentStatus) === 'success'

function BookingActions({ booking, busy, onMarkPaid, onCancel, align = 'end' }) {
  if (isCancelled(booking)) return null
  const completed = String(booking.status ?? '').toLowerCase().includes('complete')

  return (
    <div className={`flex flex-wrap gap-1.5 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {!isPaid(booking) && (
        <Button size="sm" variant="soft" loading={busy} onClick={() => onMarkPaid(booking)}>
          Mark paid
        </Button>
      )}
      {!completed && (
        <button type="button" className={DANGER_SOFT} disabled={busy} onClick={() => onCancel(booking)}>
          Cancel
        </button>
      )}
    </div>
  )
}

/* ---------------- Manual booking modal ---------------- */

function ManualBookingModal({ courts, defaultCourtId, defaultDate, onClose, onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState(() => ({
    courtId: String(defaultCourtId || courts[0]?.id || ''),
    date: defaultDate || toDateInputValue(),
    startTime: '18:00',
    endTime: '19:00',
    playerName: '',
    contactNumber: '',
    amount: '',
    paymentStatus: 'Unpaid',
    note: '',
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const court = courts.find((c) => String(c.id) === form.courtId)
  const duration = toMinutes(form.endTime) - toMinutes(form.startTime)
  const estimate =
    court?.pricePerHour != null && duration > 0
      ? Math.round((Number(court.pricePerHour) * duration) / 60)
      : null

  const validate = () => {
    const next = {}
    if (!form.courtId) next.courtId = 'Choose a court.'
    if (!form.date) next.date = 'Choose a date.'
    if (!form.startTime) next.startTime = 'Start time is required.'
    if (!form.endTime) next.endTime = 'End time is required.'
    else if (!(duration > 0)) next.endTime = 'End time must be after start time.'
    if (form.playerName.trim().length < 2) next.playerName = "Enter the player's name."
    if (!form.contactNumber.trim()) next.contactNumber = 'Contact number is required.'
    else if (!isValidNepalPhone(form.contactNumber)) next.contactNumber = 'Enter a valid 10-digit mobile number.'
    if (form.amount !== '' && (!Number.isFinite(Number(form.amount)) || Number(form.amount) < 0)) {
      next.amount = 'Enter a valid amount.'
    }
    if (form.note.length > 200) next.note = 'Note must be 200 characters or less.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setSaving(true)
    try {
      await ownerApi.createBooking({
        courtId: asId(form.courtId),
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        playerName: form.playerName.trim(),
        contactNumber: normalizePhone(form.contactNumber),
        amount: form.amount === '' ? estimate : Number(form.amount),
        paymentMethod: 'Cash',
        isPaid: form.paymentStatus === 'Paid',
        note: form.note.trim() || null,
      })
      toast.success('Booking added')
      onCreated()
    } catch (err) {
      setFormError(
        err?.response?.status === 409
          ? 'That time overlaps an existing or blocked booking.'
          : getErrorMessage(err, 'Could not add this booking.')
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="New booking"
      description="Record a walk-in or phone booking."
      size="lg"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="manual-booking-form" loading={saving} disabled={!courts.length}>
            Add booking
          </Button>
        </>
      }
    >
      {!courts.length ? (
        <div className="rounded-xl bg-ink/[0.04] px-4 py-6 text-center text-sm text-muted">
          You need at least one court before adding bookings.{' '}
          <Link to="/owner/courts" className="font-medium text-ink underline underline-offset-2">
            Add a court
          </Link>
        </div>
      ) : (
        <form id="manual-booking-form" onSubmit={handleSubmit} noValidate className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="mb-court" className="label">Court</label>
            <select
              id="mb-court"
              value={form.courtId}
              onChange={setField('courtId')}
              className={`input ${errors.courtId ? 'input-error' : ''}`}
            >
              {courts.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.courtId && <p className="field-error">{errors.courtId}</p>}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="mb-date" className="label">Date</label>
            <input
              id="mb-date"
              type="date"
              value={form.date}
              onChange={setField('date')}
              className={`input num ${errors.date ? 'input-error' : ''}`}
            />
            {errors.date && <p className="field-error">{errors.date}</p>}
          </div>

          <div>
            <label htmlFor="mb-start" className="label">Start time</label>
            <input
              id="mb-start"
              type="time"
              step="1800"
              value={form.startTime}
              onChange={setField('startTime')}
              className={`input num ${errors.startTime ? 'input-error' : ''}`}
            />
            {errors.startTime && <p className="field-error">{errors.startTime}</p>}
          </div>

          <div>
            <label htmlFor="mb-end" className="label">End time</label>
            <input
              id="mb-end"
              type="time"
              step="1800"
              value={form.endTime}
              onChange={setField('endTime')}
              className={`input num ${errors.endTime ? 'input-error' : ''}`}
            />
            {errors.endTime && <p className="field-error">{errors.endTime}</p>}
          </div>

          <div>
            <label htmlFor="mb-name" className="label">Player name</label>
            <input
              id="mb-name"
              value={form.playerName}
              onChange={setField('playerName')}
              className={`input ${errors.playerName ? 'input-error' : ''}`}
              placeholder="e.g. Anish Rai"
              maxLength={80}
            />
            {errors.playerName && <p className="field-error">{errors.playerName}</p>}
          </div>

          <div>
            <label htmlFor="mb-phone" className="label">Mobile number</label>
            <input
              id="mb-phone"
              type="tel"
              inputMode="tel"
              value={form.contactNumber}
              onChange={setField('contactNumber')}
              className={`input num ${errors.contactNumber ? 'input-error' : ''}`}
              placeholder="98XXXXXXXX"
              maxLength={16}
            />
            {errors.contactNumber && <p className="field-error">{errors.contactNumber}</p>}
          </div>

          <div>
            <label htmlFor="mb-amount" className="label">
              Amount (Rs) <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="mb-amount"
              type="number"
              inputMode="numeric"
              min="0"
              value={form.amount}
              onChange={setField('amount')}
              className={`input num ${errors.amount ? 'input-error' : ''}`}
              placeholder={estimate != null ? String(estimate) : '0'}
            />
            {errors.amount ? (
              <p className="field-error">{errors.amount}</p>
            ) : (
              estimate != null && (
                <p className="mt-1 text-xs text-muted">
                  Court rate gives <span className="num">{formatNPR(estimate)}</span>
                </p>
              )
            )}
          </div>

          <div>
            <p className="label">Payment</p>
            <div className="grid grid-cols-2 gap-2">
              {['Unpaid', 'Paid'].map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={form.paymentStatus === option}
                  onClick={() => setForm((f) => ({ ...f, paymentStatus: option }))}
                  className={`h-[46px] rounded-xl border text-sm font-medium transition-colors ${
                    form.paymentStatus === option
                      ? 'border-ink bg-ink text-white'
                      : 'border-hairline-strong bg-surface hover:border-ink/40'
                  }`}
                >
                  {option === 'Paid' ? 'Paid (cash)' : 'Not paid yet'}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="mb-note" className="label">
              Note <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="mb-note"
              value={form.note}
              onChange={setField('note')}
              className={`input ${errors.note ? 'input-error' : ''}`}
              placeholder="e.g. Booked by phone, team of 10"
              maxLength={200}
            />
            {errors.note && <p className="field-error">{errors.note}</p>}
          </div>

          {formError && (
            <div role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text sm:col-span-2">
              {formError}
            </div>
          )}
        </form>
      )}
    </Modal>
  )
}

/* ---------------- Cancel modal ---------------- */

function CancelBookingModal({ booking, onClose, onCancelled }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCancel = async () => {
    setSaving(true)
    try {
      await ownerApi.cancelBooking(booking.id, reason.trim() ? { reason: reason.trim() } : null)
      toast.success('Booking cancelled')
      onCancelled(booking.id)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not cancel this booking.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Cancel this booking?"
      description="The slot will be released for other players."
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>
            Keep booking
          </Button>
          <Button variant="danger" onClick={handleCancel} loading={saving}>
            Yes, cancel
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-canvas px-4 py-3">
        <p className="text-sm font-medium">{booking.playerName || 'Player'}</p>
        <p className="num mt-0.5 text-sm text-muted">
          {formatDay(booking.date)} · {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
        </p>
        {booking.courtName && <p className="text-sm text-muted">{booking.courtName}</p>}
      </div>

      <label htmlFor="cancel-reason" className="label mt-4">
        Reason <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id="cancel-reason"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={200}
        className="input resize-none"
        placeholder="e.g. Player requested, court maintenance"
      />
    </Modal>
  )
}

/* ---------------- Page ---------------- */

export default function OwnerBookings() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const today = toDateInputValue()
  const dateParam = searchParams.get('date')
  const allDates = dateParam === 'all'
  const date = allDates ? '' : dateParam || today
  const courtId = searchParams.get('courtId') ?? ''
  const status = searchParams.get('status') ?? ''
  const view = searchParams.get('view') === 'schedule' ? 'schedule' : 'list'

  const updateParams = (changes) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(changes).forEach(([key, value]) => {
          if (value) next.set(key, value)
          else next.delete(key)
        })
        return next
      },
      { replace: true }
    )
  }

  /* Courts */
  const [courts, setCourts] = useState([])
  useEffect(() => {
    let active = true
    ownerApi
      .courts()
      .then((data) => {
        if (active) setCourts(toList(data))
      })
      .catch(() => {
        if (active) setCourts([])
      })
    return () => {
      active = false
    }
  }, [])

  /* Bookings */
  const [reload, setReload] = useState(0)
  const apiParams = useMemo(() => {
    const params = {}
    if (date) params.date = date
    if (courtId) params.courtId = courtId
    if (status) params.status = status
    return params
  }, [date, courtId, status])

  const requestKey = `${JSON.stringify(apiParams)}#${reload}`
  const [result, setResult] = useState({ key: null, items: [], error: null })
  const loading = result.key !== requestKey

  useEffect(() => {
    let active = true
    ownerApi
      .bookings(apiParams)
      .then((data) => {
        if (active) setResult({ key: requestKey, items: toList(data).map(toOwnerBooking).filter(Boolean), error: null })
      })
      .catch((err) => {
        if (active) setResult({ key: requestKey, items: [], error: getErrorMessage(err, 'Could not load bookings.') })
      })
    return () => {
      active = false
    }
  }, [apiParams, requestKey])

  /* Local filters */
  const [search, setSearch] = useState('')
  const [unpaidOnly, setUnpaidOnly] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return result.items
      .filter((b) => !unpaidOnly || (!isPaid(b) && !isCancelled(b)))
      .filter(
        (b) =>
          !q ||
          [b.playerName, b.contactNumber, b.referenceCode].some((v) => String(v ?? '').toLowerCase().includes(q))
      )
      .sort(
        (a, b) =>
          String(a.date).localeCompare(String(b.date)) ||
          (toMinutes(a.startTime) || 0) - (toMinutes(b.startTime) || 0)
      )
  }, [result.items, search, unpaidOnly])

  const totals = useMemo(() => {
    const live = rows.filter((b) => !isCancelled(b))
    return {
      count: live.length,
      collected: live.filter(isPaid).reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
      pending: live.filter((b) => !isPaid(b)).reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
    }
  }, [rows])

  /* Schedule groups */
  const groups = useMemo(() => {
    const map = new Map()
    courts.forEach((c) => map.set(String(c.id), { id: String(c.id), name: c.name, items: [] }))
    rows.forEach((b) => {
      const key = b.courtId != null ? String(b.courtId) : `name:${b.courtName}`
      if (!map.has(key)) {
        const byName = [...map.values()].find((g) => g.name && g.name === b.courtName)
        if (byName) {
          byName.items.push(b)
          return
        }
        map.set(key, { id: key, name: b.courtName || 'Other', items: [] })
      }
      map.get(key).items.push(b)
    })
    const list = [...map.values()]
    return courtId ? list.filter((g) => g.id === String(courtId)) : list
  }, [courts, rows, courtId])

  /* Actions */
  const [busyId, setBusyId] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [manualOpen, setManualOpen] = useState(() => searchParams.get('new') === '1')

  const updateItem = (id, patch) => {
    setResult((r) => ({ ...r, items: r.items.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
  }

  const markPaid = async (booking) => {
    setBusyId(booking.id)
    try {
      await ownerApi.markPaid(booking.id)
      updateItem(booking.id, { paymentStatus: 'Paid' })
      toast.success(`${booking.playerName || 'Booking'} marked as paid`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not mark as paid.'))
    } finally {
      setBusyId(null)
    }
  }

  const closeManual = () => {
    setManualOpen(false)
    if (searchParams.get('new')) updateParams({ new: '' })
  }

  const columns = [
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
      key: 'player',
      header: 'Player',
      render: (b) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{b.playerName || '—'}</span>
            {b.source && (
              <StatusPill variant="info" dot={false}>
                {b.source}
              </StatusPill>
            )}
          </div>
          <p className="num text-xs text-muted">{b.contactNumber || '—'}</p>
        </div>
      ),
    },
    { key: 'court', header: 'Court', hideBelow: 'md', render: (b) => b.courtName || '—' },
    { key: 'ref', header: 'Ref', hideBelow: 'xl', mono: true, render: (b) => b.referenceCode || '—' },
    { key: 'amount', header: 'Amount', align: 'right', render: (b) => formatNPR(b.amount) },
    {
      key: 'payment',
      header: 'Payment',
      hideBelow: 'sm',
      render: (b) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill status={b.paymentStatus || 'Unpaid'} />
          <span className="text-xs text-muted">{b.paymentMethod === 'Esewa' ? 'eSewa' : b.paymentMethod || 'Cash'}</span>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (b) => <StatusPill status={b.status} /> },
    {
      key: 'actions',
      header: '',
      render: (b) => (
        <BookingActions booking={b} busy={busyId === b.id} onMarkPaid={markPaid} onCancel={setCancelTarget} />
      ),
    },
  ]

  const segment = (active) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-surface text-ink' : 'text-muted hover:text-ink'}`

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description="See who's playing, collect cash payments, and add walk-in or phone bookings."
        actions={
          <Button onClick={() => setManualOpen(true)}>
            <Icon name="plus" className="h-[18px] w-[18px]" />
            New booking
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border bg-surface p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="soft"
            size="icon"
            aria-label="Previous day"
            onClick={() => updateParams({ date: shiftDate(date || today, -1) })}
          >
            <Icon name="chevronLeft" />
          </Button>
          <input
            type="date"
            aria-label="Date"
            value={date}
            onChange={(e) => updateParams({ date: e.target.value || 'all' })}
            className="input num h-10 w-auto py-0"
          />
          <Button
            variant="soft"
            size="icon"
            aria-label="Next day"
            onClick={() => updateParams({ date: shiftDate(date || today, 1) })}
          >
            <Icon name="chevronRight" />
          </Button>
          <Button variant="soft" size="sm" onClick={() => updateParams({ date: '' })} disabled={date === today}>
            Today
          </Button>
          <button
            type="button"
            aria-pressed={allDates}
            onClick={() => updateParams({ date: allDates ? '' : 'all' })}
            className={`h-9 rounded-xl border px-3 text-sm font-medium transition-colors ${
              allDates ? 'border-ink bg-ink text-white' : 'border-hairline-strong hover:border-ink/40'
            }`}
          >
            All dates
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Court"
            value={courtId}
            onChange={(e) => updateParams({ courtId: e.target.value })}
            className="input h-10 w-auto py-0 text-sm"
          >
            <option value="">All courts</option>
            {courts.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Status"
            value={status}
            onChange={(e) => updateParams({ status: e.target.value })}
            className="input h-10 w-auto py-0 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div role="tablist" aria-label="View" className="flex rounded-xl bg-ink/[0.05] p-1">
            <button type="button" role="tab" aria-selected={view === 'list'} className={segment(view === 'list')} onClick={() => updateParams({ view: '' })}>
              List
            </button>
            <button type="button" role="tab" aria-selected={view === 'schedule'} className={segment(view === 'schedule')} onClick={() => updateParams({ view: 'schedule' })}>
              By court
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-3 divide-x divide-hairline rounded-2xl border bg-surface">
        <div className="px-4 py-3">
          <p className="eyebrow">Bookings</p>
          <p className="num mt-1 text-lg font-medium">{loading ? '—' : totals.count}</p>
        </div>
        <div className="px-4 py-3">
          <p className="eyebrow">Collected</p>
          <p className="num mt-1 text-lg font-medium text-success-text">{loading ? '—' : formatNPR(totals.collected)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="eyebrow">Pending</p>
          <p className="num mt-1 text-lg font-medium text-warning-text">{loading ? '—' : formatNPR(totals.pending)}</p>
        </div>
      </div>

      {view === 'list' ? (
        <DataTable
          toolbar={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative block sm:w-72">
                <span className="sr-only">Search bookings</span>
                <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, phone or reference"
                  className="input h-10 py-0 pl-9 text-sm"
                />
              </label>
              <button
                type="button"
                aria-pressed={unpaidOnly}
                onClick={() => setUnpaidOnly((v) => !v)}
                className={`h-9 self-start rounded-xl border px-3 text-sm font-medium transition-colors sm:self-auto ${
                  unpaidOnly ? 'border-ink bg-ink text-white' : 'border-hairline-strong hover:border-ink/40'
                }`}
              >
                Unpaid only
              </button>
            </div>
          }
          columns={columns}
          data={rows}
          loading={loading}
          error={result.error}
          onRetry={() => setReload((n) => n + 1)}
          rowKey={(b, i) => b.id ?? b.referenceCode ?? i}
          emptyMessage={allDates ? 'No bookings found.' : `No bookings on ${formatDay(date)}.`}
          minWidth={900}
        />
      ) : allDates ? (
        <div className="rounded-2xl border bg-surface px-5 py-12 text-center text-sm text-muted">
          Pick a date to see the schedule by court.
        </div>
      ) : loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : result.error ? (
        <div className="rounded-2xl border bg-surface px-5 py-12 text-center">
          <StatusPill variant="danger">Error</StatusPill>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">{result.error}</p>
          <Button variant="soft" size="sm" className="mt-4" onClick={() => setReload((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border bg-surface px-5 py-12 text-center text-sm text-muted">
          No courts yet.{' '}
          <Link to="/owner/courts" className="font-medium text-ink underline underline-offset-2">
            Add your first court
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <section key={group.id} className="flex flex-col rounded-2xl border bg-surface">
              <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                <div className="min-w-0">
                  <p className="eyebrow">{formatDay(date)}</p>
                  <h3 className="mt-0.5 truncate text-base font-semibold">{group.name}</h3>
                </div>
                <span className="num rounded-md bg-ink/[0.06] px-2 py-0.5 text-xs">{group.items.length}</span>
              </div>

              {group.items.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted">No bookings on this court.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {group.items.map((b) => (
                    <li key={b.id ?? b.referenceCode} className={`flex gap-3 px-5 py-3 ${isCancelled(b) ? 'opacity-55' : ''}`}>
                      <div className="w-14 shrink-0">
                        <p className={`num text-sm font-medium ${isCancelled(b) ? 'line-through' : ''}`}>{formatTime(b.startTime)}</p>
                        <p className="num text-xs text-muted">{formatTime(b.endTime)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-medium">{b.playerName || 'Player'}</p>
                          {b.source && (
                            <StatusPill variant="info" dot={false}>
                              {b.source}
                            </StatusPill>
                          )}
                        </div>
                        <p className="num text-xs text-muted">
                          {b.contactNumber || '—'} · {formatNPR(b.amount)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <StatusPill status={b.status} />
                          {!isCancelled(b) && <StatusPill status={b.paymentStatus || 'Unpaid'} />}
                        </div>
                        <div className="mt-2">
                          <BookingActions
                            booking={b}
                            align="start"
                            busy={busyId === b.id}
                            onMarkPaid={markPaid}
                            onCancel={setCancelTarget}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {manualOpen && (
        <ManualBookingModal
          courts={courts}
          defaultCourtId={courtId}
          defaultDate={date || today}
          onClose={closeManual}
          onCreated={() => {
            closeManual()
            setReload((n) => n + 1)
          }}
        />
      )}

      {cancelTarget && (
        <CancelBookingModal
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={(id) => {
            updateItem(id, { status: 'Cancelled' })
            setCancelTarget(null)
          }}
        />
      )}
    </>
  )
}