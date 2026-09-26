import { useEffect, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import { Icon } from '../../components/SidebarNav.jsx'
import StatusPill, { statusVariant } from '../../components/StatusPill.jsx'
import { useToast } from '../../components/Toast.jsx'
import {
  bookingCache,
  formatDay,
  formatNPR,
  formatTime,
  getErrorMessage,
  normalizeBooking,
  publicApi,
} from '../../services/api.js'

const TONES = {
  success: { box: 'bg-success-bg', icon: 'bg-success-text', text: 'text-success-text', iconName: 'check' },
  warning: { box: 'bg-warning-bg', icon: 'bg-warning-text', text: 'text-warning-text', iconName: 'clock' },
  danger: { box: 'bg-danger-bg', icon: 'bg-danger-text', text: 'text-danger-text', iconName: 'close' },
}

function getBanner(booking, paymentFailed, paymentSucceeded) {
  const status = String(booking?.status ?? '').toLowerCase()
  const method = String(booking?.paymentMethod ?? '').toLowerCase()
  const paid = statusVariant(booking?.paymentStatus) === 'success'

  if (status.includes('cancel')) {
    return { tone: 'danger', title: 'This booking is cancelled', text: 'The slot has been released. You can book another time.' }
  }
  if (paymentFailed) {
    return { tone: 'danger', title: 'Payment not completed', text: "Your eSewa payment didn't go through. Check the booking status below or contact the venue." }
  }
  if (method.includes('esewa') && !paid && !paymentSucceeded) {
    return { tone: 'warning', title: 'Waiting for payment', text: "We haven't received your eSewa payment yet. The status will show Paid once it's confirmed." }
  }
  if (method.includes('cash')) {
    return { tone: 'success', title: "You're booked!", text: 'Pay cash at the venue when you arrive.' }
  }
  return { tone: 'success', title: "You're booked!", text: 'Your payment is confirmed. See you on the court.' }
}

function Row({ label, children, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      <dd className={`min-w-0 text-right text-sm ${mono ? 'num' : 'font-medium'}`}>{children}</dd>
    </div>
  )
}

export default function BookingConfirmation() {
  const { referenceCode = '' } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const paymentResult = (searchParams.get('payment') ?? searchParams.get('status') ?? '').toLowerCase()
  const paymentFailed = ['fail', 'cancel', 'error'].some((w) => paymentResult.includes(w))
  const paymentSucceeded = paymentResult.includes('success') || paymentResult === 'paid'

  const contact = location.state?.contact ?? bookingCache.getContact(referenceCode)
  const stateBooking = location.state?.booking ? normalizeBooking(location.state.booking) : null

  const [reload, setReload] = useState(0)
  const requestKey = contact ? `${referenceCode}|${contact}#${reload}` : null
  const [result, setResult] = useState({ key: null, booking: null, error: null })
  const loading = requestKey !== null && result.key !== requestKey

  useEffect(() => {
    if (requestKey === null) return
    let active = true
    publicApi
      .lookupBooking(referenceCode, contact)
      .then((data) => {
        if (active) setResult({ key: requestKey, booking: normalizeBooking(data), error: null })
      })
      .catch((err) => {
        if (active) setResult({ key: requestKey, booking: null, error: getErrorMessage(err, 'Could not refresh booking status.') })
      })
    return () => {
      active = false
    }
  }, [referenceCode, contact, requestKey])

  const booking = (!loading && result.booking) || stateBooking
  const banner = booking ? getBanner(booking, paymentFailed, paymentSucceeded) : null
  const tone = banner ? TONES[banner.tone] : null

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(referenceCode)
      toast.success('Reference code copied')
    } catch {
      toast.error('Could not copy. Please write the code down.')
    }
  }

  return (
    <div className="player-container pt-6 pb-8 lg:pt-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
        {/* Banner (left, row 1) */}
        <div className="lg:col-start-1 lg:row-start-1">
          {loading && !booking ? (
            <div className="skeleton h-24 rounded-2xl" />
          ) : banner ? (
            <div className={`flex items-start gap-3 rounded-2xl p-4 sm:p-5 ${tone.box}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${tone.icon}`}>
                <Icon name={tone.iconName} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className={`text-xl font-semibold sm:text-2xl ${tone.text}`}>{banner.title}</h1>
                <p className="mt-0.5 text-sm text-ink/80">{banner.text}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border bg-surface p-4 sm:p-5">
              <p className="eyebrow">Booking</p>
              <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Your reference code</h1>
            </div>
          )}
        </div>

        {/* Reference code (right, row 1) */}
        <div className="rounded-2xl border bg-surface p-5 lg:col-start-2 lg:row-start-1">
          <p className="eyebrow">Reference code</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="num text-[28px] leading-none font-medium tracking-[0.06em] break-all">{referenceCode}</p>
            <Button variant="soft" size="sm" onClick={copyCode}>
              Copy
            </Button>
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-warning-bg px-3.5 py-3">
            <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-warning-text" />
            <p className="text-sm text-warning-text">
              <span className="font-medium">Save this code.</span> You'll need it with your mobile number to check or
              cancel this booking. Take a screenshot to be safe.
            </p>
          </div>
        </div>

        {/* Details (left, row 2) */}
        <div className="rounded-2xl border bg-surface p-5 lg:col-start-1 lg:row-start-2">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Booking details</p>
            {booking?.status && <StatusPill status={booking.status} />}
          </div>

          {loading && !booking ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="skeleton h-4 w-20" />
                  <div className="skeleton h-4 w-28" />
                </div>
              ))}
            </div>
          ) : booking ? (
            <>
              <dl className="mt-3 grid divide-y divide-hairline border-t sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
                <Row label="Venue">{booking.futsalName || '—'}</Row>
                <Row label="Court">{booking.courtName || '—'}</Row>
                <Row label="Date" mono>{formatDay(booking.date)}</Row>
                <Row label="Time" mono>
                  {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                </Row>
                <Row label="Name">{booking.playerName || '—'}</Row>
                <Row label="Mobile" mono>{booking.contactNumber || contact || '—'}</Row>
                <Row label="Amount" mono>{booking.amount != null ? formatNPR(booking.amount) : '—'}</Row>
                <Row label="Payment method">{booking.paymentMethod === 'Esewa' ? 'eSewa' : booking.paymentMethod || '—'}</Row>
                <Row label="Payment status">
                  {booking.paymentStatus ? <StatusPill status={booking.paymentStatus} /> : '—'}
                </Row>
              </dl>
              {result.error && (
                <p className="mt-3 text-xs text-muted">
                  Showing saved details. Live status couldn't be refreshed.{' '}
                  <button type="button" onClick={() => setReload((n) => n + 1)} className="font-medium text-ink underline underline-offset-2">
                    Retry
                  </button>
                </p>
              )}
            </>
          ) : (
            <div className="mt-3 rounded-xl bg-ink/[0.04] px-4 py-5 text-center">
              <p className="text-sm text-muted">
                {result.error ?? 'To see full details, look up your booking with the mobile number you used.'}
              </p>
              {result.error && (
                <Button variant="soft" size="sm" className="mt-3" onClick={() => setReload((n) => n + 1)}>
                  Try again
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Actions (right, row 2) */}
        <div className="grid gap-2 pt-1 sm:grid-cols-2 lg:col-start-2 lg:row-start-2 lg:grid-cols-1 lg:pt-0">
          <Button variant="secondary" size="lg" fullWidth to={`/my-booking?ref=${encodeURIComponent(referenceCode)}`}>
            Manage booking
          </Button>
          <Button variant="soft" size="lg" fullWidth to="/">
            Book another court
          </Button>
        </div>
      </div>
    </div>
  )
}