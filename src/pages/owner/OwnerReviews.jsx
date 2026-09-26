import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button.jsx'
import Modal from '../../components/Modal.jsx'
import ReviewCard, { Stars } from '../../components/ReviewCard.jsx'
import { PageHeader } from '../../components/SidebarNav.jsx'
import StatusPill from '../../components/StatusPill.jsx'
import { useToast } from '../../components/Toast.jsx'
import { getErrorMessage, ownerApi, toList } from '../../services/api.js'

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'lowest', label: 'Lowest rating' },
  { value: 'highest', label: 'Highest rating' },
]

function normalizeReview(raw) {
  const reply = raw?.reply ?? raw?.ownerReply ?? raw?.replyText
  return {
    ...raw,
    rating: Number(raw?.rating) || 0,
    reply: typeof reply === 'string' ? reply : (reply?.text ?? reply?.message ?? ''),
    repliedAt: raw?.repliedAt ?? reply?.createdAt,
  }
}

function ReplyModal({ review, onClose, onSaved }) {
  const toast = useToast()
  const [text, setText] = useState(review.reply ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(review.reply)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const value = text.trim()
    if (value.length < 2) {
      setError('Write a reply before posting.')
      return
    }
    if (value.length > 500) {
      setError('Reply must be 500 characters or less.')
      return
    }

    setSaving(true)
    try {
      await ownerApi.replyToReview(review.id, { reply: value })
      toast.success(isEdit ? 'Reply updated' : 'Reply posted')
      onSaved(review.id, value)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not post your reply.'))
    } finally {
      setSaving(false)
    }
  }

  const name = review.reviewerName ?? review.playerName ?? review.name ?? 'Player'

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Edit your reply' : 'Reply to review'}
      description="Your reply is shown publicly under the review."
      size="md"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="reply-form" variant="secondary" loading={saving}>
            {isEdit ? 'Update reply' : 'Post reply'}
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-canvas px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{name}</p>
          <Stars value={review.rating} />
        </div>
        {review.comment ? (
          <p className="mt-1 line-clamp-4 text-sm text-ink/80">{review.comment}</p>
        ) : (
          <p className="mt-1 text-sm text-muted">No written comment.</p>
        )}
      </div>

      <form id="reply-form" onSubmit={handleSubmit} noValidate className="mt-4">
        <label htmlFor="reply-text" className="label">Your reply</label>
        <textarea
          id="reply-text"
          rows={4}
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (error) setError('')
          }}
          className={`input resize-none ${error ? 'input-error' : ''}`}
          placeholder="Thank the player, or respond to their feedback."
          maxLength={500}
        />
        <div className="mt-1 flex justify-between">
          {error ? <p className="field-error mt-0">{error}</p> : <span />}
          <span className="num text-[11px] text-faint">{text.length}/500</span>
        </div>
      </form>
    </Modal>
  )
}

export default function OwnerReviews() {
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ key: null, items: [], error: null })
  const loading = result.key !== reload

  useEffect(() => {
    let active = true
    ownerApi
      .reviews()
      .then((data) => {
        if (active) setResult({ key: reload, items: toList(data).map(normalizeReview), error: null })
      })
      .catch((err) => {
        if (active) setResult({ key: reload, items: [], error: getErrorMessage(err, 'Could not load reviews.') })
      })
    return () => {
      active = false
    }
  }, [reload])

  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [replyTarget, setReplyTarget] = useState(null)

  const reviews = result.items

  const summary = useMemo(() => {
    const count = reviews.length
    const average = count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0
    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviews.filter((r) => Math.round(r.rating) === stars).length,
    }))
    const needsReply = reviews.filter((r) => !r.reply).length
    return { count, average, distribution, needsReply, replied: count - needsReply }
  }, [reviews])

  const visible = useMemo(() => {
    const list = reviews.filter((r) => (filter === 'pending' ? !r.reply : filter === 'replied' ? Boolean(r.reply) : true))
    const time = (r) => new Date(r.createdAt ?? 0).getTime() || 0
    return [...list].sort((a, b) => {
      if (sort === 'oldest') return time(a) - time(b)
      if (sort === 'lowest') return a.rating - b.rating || time(b) - time(a)
      if (sort === 'highest') return b.rating - a.rating || time(b) - time(a)
      return time(b) - time(a)
    })
  }, [reviews, filter, sort])

  const handleSaved = (id, text) => {
    setResult((r) => ({
      ...r,
      items: r.items.map((item) => (item.id === id ? { ...item, reply: text, repliedAt: new Date().toISOString() } : item)),
    }))
    setReplyTarget(null)
  }

  const chip = (active) =>
    `inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors ${
      active ? 'border-ink bg-ink text-white' : 'border-hairline-strong bg-surface hover:border-ink/40'
    }`

  return (
    <>
      <PageHeader
        eyebrow="Reputation"
        title="Reviews"
        description="See what players say about your venue and reply publicly."
      />

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="skeleton h-72 rounded-2xl" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-36 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : result.error ? (
        <div className="rounded-2xl border bg-surface px-5 py-12 text-center">
          <StatusPill variant="danger">Error</StatusPill>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">{result.error}</p>
          <Button variant="soft" size="sm" className="mt-4" onClick={() => setReload((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Summary */}
          <aside className="rounded-2xl border bg-surface p-5 lg:sticky lg:top-6">
            <p className="eyebrow">Average rating</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="num text-[44px] leading-none font-medium">{summary.count ? summary.average.toFixed(1) : '—'}</p>
              <p className="num pb-1 text-sm text-muted">/ 5</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Stars value={summary.average} />
              <span className="text-sm text-muted">
                <span className="num">{summary.count}</span> {summary.count === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            <ul className="mt-5 space-y-2">
              {summary.distribution.map((row) => {
                const percent = summary.count ? (row.count / summary.count) * 100 : 0
                return (
                  <li key={row.stars} className="flex items-center gap-3">
                    <span className="num w-3 text-xs text-muted">{row.stars}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="num w-6 text-right text-xs text-muted">{row.count}</span>
                  </li>
                )
              })}
            </ul>

            <div className="mt-5 grid grid-cols-2 divide-x divide-hairline rounded-xl bg-canvas">
              <div className="px-3 py-2.5">
                <p className="eyebrow">Needs reply</p>
                <p className="num mt-1 text-lg font-medium text-warning-text">{summary.needsReply}</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="eyebrow">Replied</p>
                <p className="num mt-1 text-lg font-medium">{summary.replied}</p>
              </div>
            </div>
          </aside>

          {/* List */}
          <section>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chip(filter === 'all')} onClick={() => setFilter('all')}>
                  All <span className="num opacity-70">{summary.count}</span>
                </button>
                <button type="button" className={chip(filter === 'pending')} onClick={() => setFilter('pending')}>
                  Needs reply <span className="num opacity-70">{summary.needsReply}</span>
                </button>
                <button type="button" className={chip(filter === 'replied')} onClick={() => setFilter('replied')}>
                  Replied <span className="num opacity-70">{summary.replied}</span>
                </button>
              </div>
              <select
                aria-label="Sort reviews"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="input h-9 w-auto py-0 text-sm"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {visible.length === 0 ? (
              <div className="rounded-2xl border bg-surface px-5 py-12 text-center">
                <div aria-hidden="true" className="stripes mx-auto h-14 w-14 rounded-full border" />
                <p className="mt-4 text-[15px] font-medium">
                  {summary.count === 0 ? 'No reviews yet' : 'Nothing here'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {summary.count === 0
                    ? 'Reviews from players will show up here.'
                    : filter === 'pending'
                      ? "You've replied to every review."
                      : 'No reviews match this filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((review, i) => (
                  <ReviewCard key={review.id ?? i} review={review}>
                    <div className="flex flex-wrap items-center gap-2">
                      {!review.reply && <StatusPill variant="warning">Needs reply</StatusPill>}
                      <Button size="sm" variant={review.reply ? 'soft' : 'secondary'} onClick={() => setReplyTarget(review)}>
                        {review.reply ? 'Edit reply' : 'Reply'}
                      </Button>
                    </div>
                  </ReviewCard>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {replyTarget && (
        <ReplyModal review={replyTarget} onClose={() => setReplyTarget(null)} onSaved={handleSaved} />
      )}
    </>
  )
}