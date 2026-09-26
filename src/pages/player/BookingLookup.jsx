import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon } from '../../components/SidebarNav.jsx'
import StatusPill from '../../components/StatusPill.jsx'
import { useToast } from '../../components/Toast.jsx'
import {
  bookingCache,
  formatDay,
  formatNPR,
  formatTime,
  getErrorMessage,
  isBookingCancellable,
  isValidNepalPhone,
  normalizeBooking,
  normalizePhone,
  publicApi,
} from '../../services/api.js'

const REF_PATTERN = /^[A-Z0-9-]{4,30}$/

function Row({ label, children, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      <dd className={`min-w-0 text-right text-sm ${mono ? 'num' : 'font-medium'}`}>{children}</dd>
    </div>
  )
}

export default function BookingLookup() {
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const initialRef = (searchParams.get('ref') ?? '').toUpperCase()
  const [form, setForm] = useState(() => ({
    referenceCode: initialRef,
    contactNumber: bookingCache.getContact(initialRef),
  }))
  const [errors, setErrors] = useState({})
  const [searching, setSearching] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [booking, setBooking] = useState(null)
  const [lastQuery, setLastQuery] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const setField = (key) => (e) => {
    const value = key === 'referenceCode' ? e.target.value.toUpperCase().replace(/\s/g, '') : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.referenceCode) next.referenceCode = 'Reference code is required.'
    else if (!REF_PATTERN.test(form.referenceCode)) next.referenceCode = 'Enter the code exactly as shown on your confirmation.'
    if (!form.contactNumber.trim()) next.contactNumber = 'Mobile number is required.'
    else if (!isValidNepalPhone(form.contactNumber)) next.contactNumber = 'Enter a valid 10-digit mobile number.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    setLookupError('')
    if (!validate()) return

    const query = { ref: form.referenceCode, contact: normalizePhone(form.contactNumber) }
    setSearching(true)
    setBooking(null)
    try {
      const data = await publicApi.lookupBooking(query.ref, query.contact)
      setBooking(normalizeBooking(data))
      setLastQuery(query)
      bookingCache.save(query.ref, query.contact)
    } catch (err) {
      if (err?.response?.status === 404) {
        setLookupError('No booking matches that reference code and mobile number.')
      } else {
        setLookupError(getErrorMessage(err, 'Could not look up your booking.'))
      }
    } finally {
      setSearching(false)
    }
  }

  const handleCancel = async () => {
    if (!lastQuery) return
    setCancelling(true)
    try {
      const response = await publicApi.cancelBooking(lastQuery.ref, lastQuery.contact)
      const updated =
        response && typeof response === 'object' && (response.status || response.booking)
          ? normalizeBooking(response)
          : { ...booking, status: 'Cancelled', canCancel: false }
      setBooking(updated)
      setConfirmOpen(false)
      toast.success('Your booking has been cancelled')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not cancel this booking.'))
    } finally {
      setCancelling(false)
    }
  }

  const isCancelled = String(booking?.status ?? '').toLowerCase().includes('cancel')
  const canCancel = booking && !isCancelled && isBookingCancellable(booking)
  const paidOnline =
    String(booking?.paymentMethod ?? '').toLowerCase().includes('esewa') &&
    String(booking?.paymentStatus ?? '').toLowerCase() === 'paid'

  return (
    <div className="player-container pt-7 pb-8 lg:pt-12">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2 lg:items-start lg:gap-10">
        {/* ============ Form ============ */}
        <div>
          <p className="eyebrow">Manage booking</p>
          <h1 className="mt-2 text-[28px] leading-tight font-semibold sm:text-[34px]">Find your booking</h1>
          <p className="mt-1 text-[15px] text-muted">
            Enter the reference code from your confirmation and the mobile number you booked with.
          </p>

          <form onSubmit={handleSearch} noValidate className="mt-5 rounded-2xl border bg-surface p-5 sm:p-6">
            <div>
              <label htmlFor="referenceCode" className="label">Reference code</label>
              <input
                id="referenceCode"
                value={form.referenceCode}
                onChange={setField('referenceCode')}
                className={`input num tracking-[0.06em] uppercase ${errors.referenceCode ? 'input-error' : ''}`}
                placeholder="FB-XXXXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={30}
              />
              {errors.referenceCode && <p className="field-error">{errors.referenceCode}</p>}
            </div>

            <div className="mt-3">
              <label htmlFor="lookupContact" className="label">Mobile number</label>
              <input
                id="lookupContact"
                type="tel"
                inputMode="tel"
                value={form.contactNumber}
                onChange={setField('contactNumber')}
                className={`input num ${errors.contactNumber ? 'input-error' : ''}`}
                placeholder="98XXXXXXXX"
                autoComplete="tel"
                maxLength={16}
              />
              {errors.contactNumber && <p className="field-error">{errors.contactNumber}</p>}
            </div>

            {lookupError && (
              <div role="alert" className="mt-3 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">
                {lookupError}
              </div>
            )}

            <Button type="submit" variant="secondary" size="lg" fullWidth className="mt-4" loading={searching}>
              <Icon name="search" className="h-[18px] w-[18px]" />
              Find booking
            </Button>
          </form>
        </div>

        {/* ============ Result ============ */}
        <div className="lg:pt-[108px]">
          {searching ? (
            <div className="space-y-3 rounded-2xl border bg-surface p-5">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-6 w-48" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="skeleton h-4 w-20" />
                  <div className="skeleton h-4 w-28" />
                </div>
              ))}
            </div>
          ) : booking ? (
            <div className="animate-slide-up rounded-2xl border bg-surface p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">Reference</p>
                  <p className="num mt-1 text-xl font-medium tracking-[0.06em]">{booking.referenceCode || lastQuery?.ref}</p>
                </div>
                {booking.status && <StatusPill status={booking.status} />}
              </div>

              <dl className="mt-4 divide-y divide-hairline border-t">
                <Row label="Venue">{booking.futsalName || '—'}</Row>
                <Row label="Court">{booking.courtName || '—'}</Row>
                <Row label="Date" mono>{formatDay(booking.date)}</Row>
                <Row label="Time" mono>
                  {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                </Row>
                <Row label="Name">{booking.playerName || '—'}</Row>
                <Row label="Amount" mono>{booking.amount != null ? formatNPR(booking.amount) : '—'}</Row>
                <Row label="Payment method">{booking.paymentMethod === 'Esewa' ? 'eSewa' : booking.paymentMethod || '—'}</Row>
                <Row label="Payment status">
                  {booking.paymentStatus ? <StatusPill status={booking.paymentStatus} /> : '—'}
                </Row>
              </dl>

              {canCancel ? (
                <Button variant="danger" size="lg" fullWidth className="mt-4" onClick={() => setConfirmOpen(true)}>
                  Cancel booking
                </Button>
              ) : (
                !isCancelled && (
                  <p className="mt-4 rounded-xl bg-ink/[0.04] px-4 py-3 text-sm text-muted">
                    This booking can no longer be cancelled online. Please contact the venue directly.
                  </p>
                )
              )}
            </div>
          ) : (
            <div className="hidden rounded-2xl border border-dashed bg-surface/50 px-6 py-14 text-center lg:block">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink/[0.05] text-muted">
                <Icon name="receipt" />
              </span>
              <p className="mt-4 text-[15px] font-medium">Your booking will appear here</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                You'll see the venue, time, payment status and a cancel option if it's still allowed.
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !cancelling && setConfirmOpen(false)}
        title="Cancel this booking?"
        description="The slot will be released for other players. This can't be undone."
        size="sm"
        footer={
          <>
            <Button variant="soft" onClick={() => setConfirmOpen(false)} disabled={cancelling}>
              Keep booking
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling}>
              Yes, cancel
            </Button>
          </>
        }
      >
        {booking && (
          <div className="rounded-xl bg-canvas px-4 py-3">
            <p className="text-sm font-medium">{booking.futsalName}</p>
            <p className="num mt-0.5 text-sm text-muted">
              {formatDay(booking.date)} · {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
            </p>
          </div>
        )}
        {paidOnline && (
          <p className="mt-3 text-sm text-muted">
            You paid online with eSewa. Contact the venue about getting your refund.
          </p>
        )}
      </Modal>
    </div>
  )
}