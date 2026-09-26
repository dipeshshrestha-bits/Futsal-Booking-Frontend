import { formatDate } from '../services/api.js'

export function Stars({ value = 0, size = 'sm' }) {
  const rounded = Math.round(Number(value) || 0)
  const iconSize = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rounded} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`${iconSize} ${n <= rounded ? 'text-ink' : 'text-ink/15'}`}
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </span>
  )
}

export default function ReviewCard({ review, futsalName, children, className = '' }) {
  if (!review) return null

  const name = review.reviewerName ?? review.playerName ?? review.name ?? 'Player'
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'P'

  const reply = review.reply ?? review.ownerReply ?? review.replyText
  const replyText = typeof reply === 'string' ? reply : (reply?.text ?? reply?.message)
  const repliedAt = review.repliedAt ?? reply?.createdAt

  return (
    <article className={`rounded-2xl border bg-surface p-4 sm:p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-sm font-medium text-ink">
          {initials}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="truncate text-[15px] font-medium">{name}</p>
            <span className="num text-xs text-faint">{formatDate(review.createdAt)}</span>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <Stars value={review.rating} />
            <span className="num text-xs text-muted">{Number(review.rating || 0).toFixed(1)}</span>
            {futsalName && <span className="truncate text-xs text-muted">· {futsalName}</span>}
          </div>

          {review.comment && (
            <p className="mt-2 text-[14.5px] leading-relaxed whitespace-pre-line text-ink/90">
              {review.comment}
            </p>
          )}

          {replyText && (
            <div className="mt-3 rounded-xl bg-canvas px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="eyebrow">Owner reply</p>
                {repliedAt && <span className="num text-[11px] text-faint">{formatDate(repliedAt)}</span>}
              </div>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink/90">{replyText}</p>
            </div>
          )}

          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </article>
  )
}