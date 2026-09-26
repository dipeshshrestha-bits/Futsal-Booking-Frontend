import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getSlotEnd, getSlotStart, getSlotStatus } from '../../components/AvailabilitySlotGrid.jsx'
import Button from '../../components/Button.jsx'
import Card from '../../components/Card.jsx'
import { Icon } from '../../components/SidebarNav.jsx'
import StatusPill from '../../components/StatusPill.jsx'
import { useToast } from '../../components/Toast.jsx'
import {
  asId,
  bookingCache,
  extractEsewaForm,
  formatDay,
  formatNPR,
  formatTime,
  getErrorMessage,
  isValidNepalPhone,
  normalizeBooking,
  normalizePhone,
  publicApi,
  submitEsewaForm,
  toList,
} from '../../services/api.js'

const PAYMENT_OPTIONS = [
  {
    value: 'Cash',
    title: 'Cash on arrival',
    description: 'Pay at the venue before your game.',
    icon: 'cash',
  },
  {
    value: 'Esewa',
    title: 'eSewa',
    description: "Pay online now. You'll be taken to eSewa to complete payment.",
    icon: 'lock',
  },
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toSlots(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.slots)) return data.slots
  return toList(data)
}

function SectionNumber({ n }) {
  return <span className="num mr-2 text-faint">{String(n).padStart(2, '0')}</span>
}

export default function BookingPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()

  const courtId = searchParams.get('courtId') ?? ''
  const date = searchParams.get('date') ?? ''
  const start = searchParams.get('start') ?? ''
  const end = searchParams.get('end') ?? ''
  const hasSlot = Boolean(courtId && date && start && end)
  const backToVenue = `/futsals/${id}?date=${date}&court=${courtId}`

  /* ---------- Load venue + confirm slot ---------- */
  const [reload, setReload] = useState(0)
  const requestKey = hasSlot ? `${id}|${courtId}|${date}|${start}|${end}#${reload}` : null
  const [data, setData] = useState({ key: null, futsal: null, slot: null, error: null })
  const loading = requestKey !== null && data.key !== requestKey

  useEffect(() => {
    if (requestKey === null) return
    let active = true
    Promise.all([publicApi.futsal(id), publicApi.availability(id, courtId, date)])
      .then(([futsal, availability]) => {
        const slot =
          toSlots(availability).find(
            (s) => formatTime(getSlotStart(s)) === start && formatTime(getSlotEnd(s)) === end
          ) ?? null
        if (active) setData({ key: requestKey, futsal, slot, error: null })
      })
      .catch((err) => {
        if (active) {
          setData({ key: requestKey, futsal: null, slot: null, error: getErrorMessage(err, 'Could not load booking details.') })
        }
      })
    return () => {
      active = false
    }
  }, [id, courtId, date, start, end, requestKey])

  /* ---------- Form ---------- */
  const [form, setForm] = useState({ playerName: '', contactNumber: '', email: '' })
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    const name = form.playerName.trim()
    if (name.length < 2) next.playerName = 'Please enter your full name.'
    else if (name.length > 80) next.playerName = 'Name must be 80 characters or less.'
    if (!form.contactNumber.trim()) next.contactNumber = 'Contact number is required.'
    else if (!isValidNepalPhone(form.contactNumber)) next.contactNumber = 'Enter a valid 10-digit mobile number (e.g. 98XXXXXXXX).'
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) next.email = 'Enter a valid email address.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const futsal = data.futsal
  const court = toList(futsal?.courts).find((c) => String(c.id) === String(courtId)) ?? null
  const slotStatus = data.slot ? getSlotStatus(data.slot, date) : 'missing'
  const slotAvailable = slotStatus === 'available'
  const price = data.slot?.price ?? court?.pricePerHour

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    if (!slotAvailable || !validate()) return

    const contactNumber = normalizePhone(form.contactNumber)
    const payload = {
      futsalId: asId(id),
      courtId: asId(courtId),
      date,
      startTime: start,
      endTime: end,
      playerName: form.playerName.trim(),
      contactNumber,
      email: form.email.trim() || null,
      paymentMethod,
    }

    setSubmitting(true)
    try {
      const response = await publicApi.createBooking(payload)
      const booking = normalizeBooking(response)
      const referenceCode = booking?.referenceCode

      if (!referenceCode) {
        throw new Error('Your booking was received, but no reference code came back. Please contact the venue.')
      }

      bookingCache.save(referenceCode, contactNumber)

      if (paymentMethod === 'Esewa') {
        const esewaForm = extractEsewaForm(response)
        if (esewaForm) {
          setRedirecting(true)
          submitEsewaForm(esewaForm)
          return
        }
        toast.error('Booking created, but eSewa payment could not start. You can pay cash at the venue.')
      }

      navigate(`/booking/confirmation/${encodeURIComponent(referenceCode)}`, {
        replace: true,
        state: { booking: response, contact: contactNumber },
      })
    } catch (err) {
      if (err?.response?.status === 409) {
        setSubmitError('Sorry, someone just booked this slot. Please choose another time.')
      } else {
        setSubmitError(getErrorMessage(err, 'Could not complete your booking. Please try again.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  /* ---------- Render ---------- */
  if (!hasSlot) {
    return (
      <div className="player-container py-10">
        <div className="mx-auto max-w-lg rounded-2xl border bg-surface px-5 py-10 text-center">
          <p className="text-[15px] font-medium">No slot selected</p>
          <p className="mt-1 text-sm text-muted">Go back and choose a date and time first.</p>
          <Button variant="secondary" size="sm" className="mt-5" to={`/futsals/${id}`}>
            Choose a slot
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="player-container space-y-4 py-5">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-8 w-56" />
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
          <div className="space-y-3">
            <div className="skeleton h-64 rounded-2xl" />
            <div className="skeleton h-48 rounded-2xl" />
          </div>
          <div className="skeleton order-first h-56 rounded-2xl lg:order-none" />
        </div>
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="player-container py-10">
        <div className="mx-auto max-w-lg rounded-2xl border bg-surface px-5 py-10 text-center">
          <p className="text-[15px] font-medium">Couldn't load booking details</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{data.error}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="soft" size="sm" to={backToVenue}>
              Back
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const confirmLabel = paymentMethod === 'Esewa' ? 'Pay with eSewa' : 'Confirm booking'

  return (
    <div className="player-container pt-4 pb-32 lg:pt-6 lg:pb-12">
      <Link to={backToVenue} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="chevronLeft" className="h-4 w-4" />
        Change slot
      </Link>

      <p className="eyebrow mt-4">Checkout</p>
      <h1 className="mt-1 text-[28px] leading-tight font-semibold sm:text-[34px]">Confirm your booking</h1>

      <div className="mt-5 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
        {/* ============ Form (left) ============ */}
        <form id="booking-form" onSubmit={handleSubmit} noValidate className="space-y-3">
          <Card padding="md">
            <p className="eyebrow">
              <SectionNumber n={2} />
              Your details
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="playerName" className="label">Full name</label>
                <input
                  id="playerName"
                  value={form.playerName}
                  onChange={setField('playerName')}
                  className={`input ${errors.playerName ? 'input-error' : ''}`}
                  placeholder="e.g. Sujan Thapa"
                  autoComplete="name"
                  maxLength={80}
                />
                {errors.playerName && <p className="field-error">{errors.playerName}</p>}
              </div>

              <div>
                <label htmlFor="contactNumber" className="label">Mobile number</label>
                <input
                  id="contactNumber"
                  type="tel"
                  inputMode="tel"
                  value={form.contactNumber}
                  onChange={setField('contactNumber')}
                  className={`input num ${errors.contactNumber ? 'input-error' : ''}`}
                  placeholder="98XXXXXXXX"
                  autoComplete="tel"
                  maxLength={16}
                />
                {errors.contactNumber ? (
                  <p className="field-error">{errors.contactNumber}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted">You'll need this to look up or cancel your booking.</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="label">
                  Email <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={setField('email')}
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>
            </div>
          </Card>

          <Card padding="md">
            <p className="eyebrow">
              <SectionNumber n={3} />
              Payment
            </p>

            <div role="radiogroup" aria-label="Payment method" className="mt-3 grid gap-2 sm:grid-cols-2">
              {PAYMENT_OPTIONS.map((option) => {
                const active = paymentMethod === option.value
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                      active ? 'border-ink bg-canvas' : 'border-hairline-strong hover:border-ink/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.value}
                      checked={active}
                      onChange={() => setPaymentMethod(option.value)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        active ? 'bg-ink text-white' : 'bg-ink/[0.05] text-muted'
                      }`}
                    >
                      <Icon name={option.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium">{option.title}</span>
                      <span className="block text-sm text-muted">{option.description}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        active ? 'border-ink' : 'border-hairline-strong'
                      }`}
                    >
                      {active && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                    </span>
                  </label>
                )
              })}
            </div>
          </Card>

          {submitError && (
            <div role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">
              {submitError}{' '}
              {submitError.includes('someone just booked') && (
                <Link to={backToVenue} className="font-medium underline underline-offset-2">
                  Pick another slot
                </Link>
              )}
            </div>
          )}
        </form>

        {/* ============ Summary (first on mobile, sticky right on desktop) ============ */}
        <aside className="order-first lg:sticky lg:top-20 lg:order-none">
          <Card padding="md">
            <p className="eyebrow">
              <SectionNumber n={1} />
              Your slot
            </p>
            <h2 className="mt-2 text-lg font-semibold">{futsal?.name}</h2>
            {futsal?.address && <p className="text-sm text-muted">{futsal.address}</p>}

            <dl className="mt-3 divide-y divide-hairline border-t">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-sm text-muted">Court</dt>
                <dd className="text-sm font-medium">{court?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-sm text-muted">Date</dt>
                <dd className="num text-sm">{formatDay(date)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-sm text-muted">Time</dt>
                <dd className="num text-sm">
                  {start} – {end}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-sm text-muted">Price</dt>
                <dd className="num text-sm font-medium">{price != null ? formatNPR(price) : '—'}</dd>
              </div>
            </dl>

            {!slotAvailable && (
              <div className="mt-3 rounded-xl bg-danger-bg px-4 py-3">
                <StatusPill variant="danger">Unavailable</StatusPill>
                <p className="mt-2 text-sm text-danger-text">
                  {slotStatus === 'past' ? 'This time has already passed.' : 'This slot is no longer available.'}{' '}
                  <Link to={backToVenue} className="font-medium underline underline-offset-2">
                    Choose another slot
                  </Link>
                </p>
              </div>
            )}

            {/* Desktop confirm (mobile uses the sticky bar) */}
            <div className="mt-4 hidden border-t pt-4 lg:block">
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">Total</p>
                <p className="num text-xl font-medium">{price != null ? formatNPR(price) : '—'}</p>
              </div>
              <Button
                type="submit"
                form="booking-form"
                size="lg"
                fullWidth
                className="mt-3"
                loading={submitting}
                disabled={!slotAvailable}
              >
                {confirmLabel}
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {/* Mobile / tablet sticky CTA */}
      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t shadow-float lg:hidden">
        <div className="player-container flex items-center gap-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Total</p>
            <p className="num text-lg leading-6 font-medium">{price != null ? formatNPR(price) : '—'}</p>
          </div>
          <Button type="submit" form="booking-form" size="lg" loading={submitting} disabled={!slotAvailable}>
            {confirmLabel}
          </Button>
        </div>
      </div>

      {/* eSewa redirect overlay */}
      {redirecting && (
        <div className="fixed inset-0 z-[80] flex animate-fade-in flex-col items-center justify-center bg-canvas/95 px-6 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-ink border-r-transparent" />
          <p className="mt-5 text-lg font-semibold">Taking you to eSewa…</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Don't close this window. You'll come back here after payment.
          </p>
        </div>
      )}
    </div>
  )
}