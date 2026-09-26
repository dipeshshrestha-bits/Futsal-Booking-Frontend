import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatNPR, resolveImageUrl } from '../services/api.js'

export function getFutsalCover(futsal) {
  const list = Array.isArray(futsal?.images) ? futsal.images : []
  const first = list[0]
  const firstUrl = typeof first === 'string' ? first : (first?.url ?? first?.imageUrl)
  return resolveImageUrl(futsal?.coverImageUrl ?? futsal?.coverImage ?? futsal?.imageUrl ?? firstUrl)
}

const STRIPES = {
  backgroundColor: '#FFFFFF',
  backgroundImage:
    'repeating-linear-gradient(135deg, rgba(18,17,15,0.06) 0 10px, rgba(18,17,15,0.02) 10px 20px)',
}

export default function FutsalCard({ futsal, to }) {
  const [imageFailed, setImageFailed] = useState(false)

  if (!futsal) return null

  const id = futsal.id ?? futsal.futsalId
  const name = futsal.name ?? futsal.futsalName ?? 'Unnamed venue'
  const city = futsal.city ?? futsal.location ?? 'Futsal'
  const address = futsal.address ?? futsal.fullAddress
  const cover = getFutsalCover(futsal)

  const price = futsal.startingPrice ?? futsal.minPrice ?? futsal.pricePerHour
  const hasPrice = price !== null && price !== undefined && Number.isFinite(Number(price))

  const rating = Number(futsal.averageRating ?? futsal.rating)
  const reviewCount = futsal.reviewCount ?? futsal.totalReviews

  return (
    <Link
      to={to ?? '/futsals/' + id}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-surface transition-shadow hover:shadow-hover focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
    >
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 10', minHeight: 120 }}>
        {cover && !imageFailed ? (
          <img
            src={cover}
            alt={name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div aria-hidden="true" className="h-full w-full" style={STRIPES} />
        )}

        {Number.isFinite(rating) && rating > 0 && (
          <span className="glass absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-ink">
            <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden="true">
              <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
            </svg>
            <span className="num">{rating.toFixed(1)}</span>
            {reviewCount != null && <span className="num text-muted">({reviewCount})</span>}
          </span>
        )}
      </div>

      <div className="flex flex-1 items-end justify-between gap-3 border-t p-3.5">
        <div className="min-w-0">
          <p className="eyebrow truncate">{city}</p>
          <h3 className="mt-0.5 truncate text-base leading-snug font-semibold">{name}</h3>
          {address && <p className="mt-0.5 truncate text-[13px] text-muted">{address}</p>}
        </div>

        {hasPrice && (
          <div className="shrink-0 text-right leading-tight">
            <p className="text-[10px] text-muted">from</p>
            <p className="num text-sm font-medium">{formatNPR(price)}</p>
            <p className="num text-[10px] text-faint">/hr</p>
          </div>
        )}
      </div>
    </Link>
  )
}