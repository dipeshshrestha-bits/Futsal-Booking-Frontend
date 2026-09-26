import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AvailabilitySlotGrid, {
  getSlotEnd,
  getSlotKey,
  getSlotStart,
} from '../../components/AvailabilitySlotGrid.jsx'
import Button from '../../components/Button.jsx'
import Card from '../../components/Card.jsx'
import ReviewCard, { Stars } from '../../components/ReviewCard.jsx'
import { Icon } from '../../components/SidebarNav.jsx'
import StatusPill from '../../components/StatusPill.jsx'
import { useToast } from '../../components/Toast.jsx'
import {
  formatDay,
  formatNPR,
  formatTime,
  getErrorMessage,
  isValidNepalPhone,
  publicApi,
  resolveImageUrl,
  toDateInputValue,
  toList,
} from '../../services/api.js'

// Plain link element (named so copy/paste can't strip it as an HTML tag)
const Anchor = 'a'

const REVIEW_INITIAL = { reviewerName: '', referenceCode: '', contactNumber: '', rating: 0, comment: '' }

function getUpcomingDays(count) {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    return {
      value: toDateInputValue(d),
      label: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-GB', { weekday: 'short' }),
      day: d.getDate(),
    }
  })
}

function toSlots(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.slots)) return data.slots
  return toList(data)
}

function getGalleryImages(futsal) {
  const list = Array.isArray(futsal?.images) ? futsal.images : []
  const urls = list
    .map((img) => (typeof img === 'string' ? img : (img?.url ?? img?.imageUrl)))
    .filter(Boolean)
  const cover = futsal?.coverImageUrl ?? futsal?.coverImage ?? futsal?.imageUrl
  if (cover && !urls.includes(cover)) urls.unshift(cover)
  return urls.map(resolveImageUrl)
}

function getAmenities(futsal) {
  const raw = futsal?.amenities
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  return list.map((a) => (typeof a === 'string' ? a.trim() : (a?.name ?? ''))).filter(Boolean)
}

function Gallery({ images, name }) {
  const [failed, setFailed] = useState({})
  const visible = images.filter((src) => !failed[src])
  const markFailed = (src) => setFailed((f) => ({ ...f, [src]: true }))

  if (!visible.length) {
    return <div aria-hidden="true" className="stripes h-44 w-full rounded-2xl border sm:h-56 lg:h-60" />
  }

  const thumbs = visible.slice(1, 3)
  const extra = visible.length - 3

  return (
    <>
      {/* Phone / tablet: swipe carousel */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:hidden">
        {visible.map((src, i) => (
          <div
            key={src}
            className={
              'relative aspect-[16/10] shrink-0 snap-center overflow-hidden rounded-2xl border ' +
              (visible.length > 1 ? 'w-[88%] sm:w-[70%]' : 'w-full')
            }
          >
            <img
              src={src}
              alt={name + ' photo ' + (i + 1)}
              loading={i === 0 ? 'eager' : 'lazy'}
              onError={() => markFailed(src)}
              className="h-full w-full object-cover"
            />
            {visible.length > 1 && (
              <span className="glass num absolute right-3 bottom-3 rounded-full px-2 py-0.5 text-[11px]">
                {i + 1}/{visible.length}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: fixed-height mosaic */}
      <div
        className="hidden h-[340px] gap-3 lg:grid"
        style={{ gridTemplateColumns: thumbs.length ? '2fr 1fr' : '1fr' }}
      >
        <div className="overflow-hidden rounded-2xl border">
          <img
            src={visible[0]}
            alt={name}
            onError={() => markFailed(visible[0])}
            className="h-full w-full object-cover"
          />
        </div>

        {thumbs.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateRows: thumbs.length > 1 ? '1fr 1fr' : '1fr' }}>
            {thumbs.map((src, i) => (
              <div key={src} className="relative overflow-hidden rounded-2xl border">
                <img
                  src={src}
                  alt={name + ' photo ' + (i + 2)}
                  loading="lazy"
                  onError={() => markFailed(src)}
                  className="h-full w-full object-cover"
                />
                {i === thumbs.length - 1 && extra > 0 && (
                  <span className="glass absolute right-3 bottom-3 rounded-full px-2.5 py-1 text-xs font-medium">
                    <span className="num">+{extra}</span> more
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function RatingInput({ value, onChange, invalid }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={n + (n > 1 ? ' stars' : ' star')}
          onClick={() => onChange(n)}
          className={
            'flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ' +
            (n <= value
              ? 'border-ink bg-ink text-white'
              : 'bg-surface text-ink/25 hover:text-ink/60 ' +
                (invalid ? 'border-danger-text/50' : 'border-hairline-strong'))
          }
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
          </svg>
        </button>
      ))}
      <span className="num ml-1 text-sm text-muted">{value ? value + '/5' : '–/5'}</span>
    </div>
  )
}

function DetailsSkeleton() {
  return (
    <div className="player-container space-y-4 py-5">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton aspect-[16/10] w-full rounded-2xl lg:aspect-auto lg:h-[340px]" />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
        <div className="space-y-4">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-8 w-64" />
          <div className="skeleton h-4 w-40" />
          <div className="grid grid-cols-3 gap-2">
            <div className="skeleton h-16 rounded-xl" />
            <div className="skeleton h-16 rounded-xl" />
            <div className="skeleton h-16 rounded-xl" />
          </div>
        </div>
        <div className="skeleton mt-4 h-80 rounded-2xl lg:mt-0" />
      </div>
    </div>
  )
}

export default function FutsalDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const days = useMemo(() => getUpcomingDays(14), [])
  const today = days[0].value
  const rawDate = searchParams.get('date')
  const date = rawDate && rawDate >= today ? rawDate : today
  const courtParam = searchParams.get('court')

  /* ---------- Venue ---------- */
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ key: null, futsal: null, error: null, notFound: false })
  const requestKey = id + '#' + reload
  const loading = result.key !== requestKey

  useEffect(() => {
    let active = true
    publicApi
      .futsal(id)
      .then((futsal) => {
        if (active) setResult({ key: requestKey, futsal, error: null, notFound: false })
      })
      .catch((err) => {
        if (active) {
          setResult({
            key: requestKey,
            futsal: null,
            error: getErrorMessage(err, 'Could not load this venue.'),
            notFound: err?.response?.status === 404,
          })
        }
      })
    return () => {
      active = false
    }
  }, [id, requestKey])

  const futsal = loading ? null : result.futsal
  const courts = useMemo(() => toList(futsal?.courts).filter((c) => c?.isActive !== false), [futsal])
  const activeCourt = courts.find((c) => String(c.id) === courtParam) ?? courts[0] ?? null
  const activeCourtId = activeCourt?.id ?? null

  /* ---------- Availability ---------- */
  const [slotReload, setSlotReload] = useState(0)
  const [slotResult, setSlotResult] = useState({ key: null, slots: [], error: null })
  const slotKey = activeCourtId !== null ? id + '|' + activeCourtId + '|' + date + '#' + slotReload : null
  const slotsLoading = slotKey !== null && slotResult.key !== slotKey

  useEffect(() => {
    if (slotKey === null) return
    let active = true
    publicApi
      .availability(id, activeCourtId, date)
      .then((data) => {
        if (active) setSlotResult({ key: slotKey, slots: toSlots(data), error: null })
      })
      .catch((err) => {
        if (active) {
          setSlotResult({ key: slotKey, slots: [], error: getErrorMessage(err, 'Could not load time slots.') })
        }
      })
    return () => {
      active = false
    }
  }, [id, activeCourtId, date, slotKey])

  const [selection, setSelection] = useState(null)
  const selected =
    selection &&
    !slotsLoading &&
    String(selection.courtId) === String(activeCourtId) &&
    selection.date === date
      ? selection
      : null

  const setParam = (key, value) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(key, value)
        return next
      },
      { replace: true }
    )
  }

  /* ---------- Reviews ---------- */
  const [review, setReview] = useState(REVIEW_INITIAL)
  const [reviewErrors, setReviewErrors] = useState({})
  const [submittingReview, setSubmittingReview] = useState(false)
  const [addedReviews, setAddedReviews] = useState([])

  const validateReview = () => {
    const errors = {}
    const name = review.reviewerName.trim()
    if (name.length < 2) errors.reviewerName = 'Please enter your name.'
    else if (name.length > 60) errors.reviewerName = 'Name must be 60 characters or less.'
    if (!review.referenceCode.trim()) errors.referenceCode = 'Enter the reference code from your booking.'
    if (!isValidNepalPhone(review.contactNumber)) {
      errors.contactNumber = 'Enter the mobile number you booked with.'
    }
    if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
      errors.rating = 'Choose a rating from 1 to 5.'
    }
    if (review.comment.trim().length > 500) errors.comment = 'Comment must be 500 characters or less.'
    setReviewErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submitReview = async (e) => {
    e.preventDefault()
    if (!validateReview()) return

    const payload = {
      reviewerName: review.reviewerName.trim(),
      referenceCode: review.referenceCode.trim().toUpperCase(),
      contactNumber: review.contactNumber.trim(),
      rating: review.rating,
      comment: review.comment.trim(),
    }

    setSubmittingReview(true)
    try {
      const created = await publicApi.createReview(id, payload)
      setAddedReviews((list) => [
        {
          id: 'local-' + Date.now(),
          reviewerName: payload.reviewerName,
          rating: payload.rating,
          comment: payload.comment,
          createdAt: new Date().toISOString(),
          ...(created && typeof created === 'object' ? created : {}),
        },
        ...list,
      ])
      setReview(REVIEW_INITIAL)
      setReviewErrors({})
      toast.success('Thanks for your review!')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not post your review.'))
    } finally {
      setSubmittingReview(false)
    }
  }

  /* ---------- Book ---------- */
  const handleBook = () => {
    if (!selected) return
    const params = new URLSearchParams({
      courtId: String(activeCourtId),
      date,
      start: formatTime(getSlotStart(selected.slot)),
      end: formatTime(getSlotEnd(selected.slot)),
    })
    navigate('/futsals/' + id + '/book?' + params.toString())
  }

  /* ---------- Render ---------- */
  if (loading) return <DetailsSkeleton />

  if (result.error || !futsal) {
    return (
      <div className="player-container py-10">
        <div className="mx-auto max-w-lg rounded-2xl border bg-surface px-5 py-10 text-center">
          <p className="text-[15px] font-medium">
            {result.notFound ? 'Venue not found' : "Couldn't load this venue"}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            {result.notFound ? 'It may have been removed or is no longer listed.' : result.error}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="soft" size="sm" to="/">
              All venues
            </Button>
            {!result.notFound && (
              <Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>
                Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const images = getGalleryImages(futsal)
  const amenities = getAmenities(futsal)
  const courtPrices = courts.map((c) => Number(c.pricePerHour)).filter(Number.isFinite)
  const startingPrice =
    futsal.startingPrice ?? futsal.minPrice ?? (courtPrices.length ? Math.min(...courtPrices) : null)
  const rating = Number(futsal.averageRating ?? futsal.rating)
  const reviews = [...addedReviews, ...toList(futsal.reviews)]
  const reviewCount = futsal.reviewCount ?? reviews.length
  const phone = futsal.contactNumber ?? futsal.phone
  const mapsUrl =
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent([futsal.name, futsal.address, futsal.city].filter(Boolean).join(', '))
  const selectedPrice = selected ? (selected.slot.price ?? activeCourt?.pricePerHour) : null

  const chipClass = (active) =>
    active ? 'border-ink bg-ink text-white' : 'border-hairline-strong bg-surface hover:border-ink/40'

  const selectionSummary = selected ? (
    <>
      <p className="eyebrow truncate">
        {activeCourt?.name} · {formatDay(date)}
      </p>
      <p className="num truncate text-[15px] font-medium">
        {formatTime(getSlotStart(selected.slot))}–{formatTime(getSlotEnd(selected.slot))}
        {selectedPrice != null && <span className="text-muted"> · {formatNPR(selectedPrice)}</span>}
      </p>
    </>
  ) : (
    <>
      <p className="text-sm font-medium">Select a time slot</p>
      <p className="truncate text-xs text-muted">Pick a date and time above</p>
    </>
  )

  return (
    <div className="player-container pt-4 pb-32 lg:pt-6 lg:pb-12">
      <Link to={'/?date=' + date} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="chevronLeft" className="h-4 w-4" />
        All venues
      </Link>

      <div className="mt-3">
        <Gallery images={images} name={futsal.name} />
      </div>

      <div className="mt-6 flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-10">
        {/* ============ Info (left, row 1) ============ */}
        <div className="lg:col-start-1 lg:row-start-1">
          <section>
            <p className="eyebrow">{futsal.city ?? 'Futsal'}</p>
            <h1 className="mt-1 text-[28px] leading-tight font-semibold sm:text-[32px]">{futsal.name}</h1>
            {futsal.address && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <Icon name="pin" className="h-4 w-4 shrink-0" />
                {futsal.address}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {Number.isFinite(rating) && rating > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Stars value={rating} />
                  <span className="num text-sm">{rating.toFixed(1)}</span>
                  <span className="num text-sm text-muted">({reviewCount})</span>
                </span>
              ) : (
                <StatusPill variant="neutral" dot={false}>
                  New venue
                </StatusPill>
              )}
            </div>

            <div className="mt-4 flex gap-2 sm:max-w-md">
              {phone && (
                <Anchor
                  href={'tel:' + phone}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-ink/[0.06] text-sm font-medium transition-colors hover:bg-ink/10"
                >
                  <Icon name="phone" className="h-4 w-4" />
                  <span className="num">{phone}</span>
                </Anchor>
              )}
              <Anchor
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-ink/[0.06] text-sm font-medium transition-colors hover:bg-ink/10"
              >
                <Icon name="pin" className="h-4 w-4" />
                Directions
              </Anchor>
            </div>
          </section>

          <section className="mt-5 grid grid-cols-3 divide-x divide-hairline rounded-2xl border bg-surface">
            <div className="px-3 py-3 sm:px-4">
              <p className="eyebrow">Hours</p>
              <p className="num mt-1 text-sm">
                {futsal.openingTime
                  ? formatTime(futsal.openingTime) + '–' + formatTime(futsal.closingTime)
                  : '—'}
              </p>
            </div>
            <div className="px-3 py-3 sm:px-4">
              <p className="eyebrow">Courts</p>
              <p className="num mt-1 text-sm">{courts.length}</p>
            </div>
            <div className="px-3 py-3 sm:px-4">
              <p className="eyebrow">From</p>
              <p className="num mt-1 text-sm">{startingPrice != null ? formatNPR(startingPrice) : '—'}</p>
            </div>
          </section>

          {(futsal.description || amenities.length > 0) && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold">About</h2>
              {futsal.description && (
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed whitespace-pre-line text-ink/85">
                  {futsal.description}
                </p>
              )}
              {amenities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {amenities.map((a) => (
                    <span key={a} className="rounded-lg border bg-surface px-2.5 py-1 text-sm">
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ============ Booking panel (right, sticky on desktop) ============ */}
        <aside className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <Card eyebrow="Availability" title="Choose a slot" padding="md">
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
              {days.map((d) => {
                const active = d.value === date
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setParam('date', d.value)}
                    className={
                      'flex w-14 shrink-0 flex-col items-center rounded-xl border py-1.5 transition-colors ' +
                      chipClass(active)
                    }
                  >
                    <span className={'text-[11px] ' + (active ? 'text-white/70' : 'text-muted')}>{d.label}</span>
                    <span className="num text-base leading-6 font-medium">{d.day}</span>
                  </button>
                )
              })}
            </div>
            <p className="num mt-2 text-xs text-muted">{formatDay(date)}</p>

            {courts.length === 0 ? (
              <p className="mt-4 rounded-xl bg-ink/[0.04] px-4 py-6 text-center text-sm text-muted">
                This venue has no courts open for booking yet.
              </p>
            ) : (
              <>
                {courts.length > 1 && (
                  <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
                    {courts.map((court) => {
                      const active = String(court.id) === String(activeCourtId)
                      return (
                        <button
                          key={court.id}
                          type="button"
                          onClick={() => setParam('court', String(court.id))}
                          className={
                            'shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ' + chipClass(active)
                          }
                        >
                          <span className="block text-sm font-medium">{court.name}</span>
                          {court.pricePerHour != null && (
                            <span className={'num block text-[11px] ' + (active ? 'text-white/70' : 'text-muted')}>
                              {formatNPR(court.pricePerHour)}/hr
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="mt-4">
                  <AvailabilitySlotGrid
                    slots={slotResult.key === slotKey ? slotResult.slots : []}
                    date={date}
                    loading={slotsLoading}
                    error={slotResult.key === slotKey ? slotResult.error : null}
                    onRetry={() => setSlotReload((n) => n + 1)}
                    selectedKey={selected?.key}
                    onSelect={(slot) => setSelection({ key: getSlotKey(slot), courtId: activeCourtId, date, slot })}
                    emptyMessage="No slots available on this date."
                  />
                </div>
              </>
            )}

            {/* Desktop book button (mobile uses the sticky bar) */}
            <div className="mt-5 hidden border-t pt-4 lg:block">
              <div className="min-w-0">{selectionSummary}</div>
              <Button size="lg" fullWidth className="mt-3" disabled={!selected} onClick={handleBook}>
                Book now
              </Button>
            </div>
          </Card>
        </aside>

        {/* ============ Reviews (left, row 2) ============ */}
        <section className="lg:col-start-1 lg:row-start-2">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">What players say</p>
              <h2 className="mt-1 text-lg font-semibold">Reviews</h2>
            </div>
            {Number.isFinite(rating) && rating > 0 && (
              <p className="text-right">
                <span className="num text-2xl font-medium">{rating.toFixed(1)}</span>
                <span className="num text-sm text-muted"> / 5</span>
              </p>
            )}
          </div>

          <form onSubmit={submitReview} noValidate className="mt-3 rounded-2xl border bg-surface p-4 sm:p-5">
            <p className="text-[15px] font-medium">Played here? Leave a review</p>
            <p className="mt-0.5 text-sm text-muted">Reviews are verified against your booking code.</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="reviewerName" className="label">Your name</label>
                <input
                  id="reviewerName"
                  value={review.reviewerName}
                  onChange={(e) => setReview((r) => ({ ...r, reviewerName: e.target.value }))}
                  className={'input ' + (reviewErrors.reviewerName ? 'input-error' : '')}
                  placeholder="e.g. Sujan Thapa"
                  maxLength={60}
                  autoComplete="name"
                />
                {reviewErrors.reviewerName && <p className="field-error">{reviewErrors.reviewerName}</p>}
              </div>
              <div>
                <label htmlFor="reviewRef" className="label">Booking code</label>
                <input
                  id="reviewRef"
                  value={review.referenceCode}
                  onChange={(e) => setReview((r) => ({ ...r, referenceCode: e.target.value.toUpperCase() }))}
                  className={'input num uppercase ' + (reviewErrors.referenceCode ? 'input-error' : '')}
                  placeholder="FB-XXXXXX"
                  maxLength={30}
                />
                {reviewErrors.referenceCode && <p className="field-error">{reviewErrors.referenceCode}</p>}
              </div>
              <div>
                <label htmlFor="reviewPhone" className="label">Mobile number</label>
                <input
                  id="reviewPhone"
                  type="tel"
                  inputMode="tel"
                  value={review.contactNumber}
                  onChange={(e) => setReview((r) => ({ ...r, contactNumber: e.target.value }))}
                  className={'input num ' + (reviewErrors.contactNumber ? 'input-error' : '')}
                  placeholder="98XXXXXXXX"
                  maxLength={16}
                />
                {reviewErrors.contactNumber && <p className="field-error">{reviewErrors.contactNumber}</p>}
              </div>
            </div>

            <div className="mt-3">
              <p className="label">Rating</p>
              <RatingInput
                value={review.rating}
                invalid={Boolean(reviewErrors.rating)}
                onChange={(value) => setReview((r) => ({ ...r, rating: value }))}
              />
              {reviewErrors.rating && <p className="field-error">{reviewErrors.rating}</p>}
            </div>

            <div className="mt-3">
              <label htmlFor="comment" className="label">
                Comment <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id="comment"
                rows={3}
                value={review.comment}
                onChange={(e) => setReview((r) => ({ ...r, comment: e.target.value }))}
                className={'input resize-none ' + (reviewErrors.comment ? 'input-error' : '')}
                placeholder="Turf, lighting, parking, changing rooms…"
                maxLength={500}
              />
              <div className="mt-1 flex justify-between">
                {reviewErrors.comment ? <p className="field-error mt-0">{reviewErrors.comment}</p> : <span />}
                <span className="num text-[11px] text-faint">{review.comment.length}/500</span>
              </div>
            </div>

            <Button type="submit" variant="secondary" className="mt-3 w-full sm:w-auto" loading={submittingReview}>
              Post review
            </Button>
          </form>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {reviews.length === 0 ? (
              <p className="rounded-2xl border bg-surface px-4 py-8 text-center text-sm text-muted xl:col-span-2">
                No reviews yet. Be the first to share your experience.
              </p>
            ) : (
              reviews.map((r, i) => <ReviewCard key={r.id ?? i} review={r} />)
            )}
          </div>
        </section>
      </div>

      {/* Mobile / tablet sticky bar */}
      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t shadow-float lg:hidden">
        <div className="player-container flex items-center gap-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">{selectionSummary}</div>
          <Button size="lg" disabled={!selected} onClick={handleBook}>
            Book now
          </Button>
        </div>
      </div>
    </div>
  )
}