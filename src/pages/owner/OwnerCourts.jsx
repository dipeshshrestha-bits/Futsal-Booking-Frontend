import { useEffect, useState } from 'react'
import Button from '../../components/Button.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon, PageHeader } from '../../components/SidebarNav.jsx'
import StatusPill from '../../components/StatusPill.jsx'
import { useToast } from '../../components/Toast.jsx'
import { asId, formatNPR, formatTime, getErrorMessage, ownerApi, toDateInputValue, toList } from '../../services/api.js'

const SURFACES = ['Artificial turf', 'Synthetic', 'Wooden', 'Concrete', 'Other']
const DURATIONS = [30, 60, 90, 120]

const DANGER_SOFT =
  'inline-flex h-9 items-center justify-center rounded-xl bg-danger-bg px-3.5 text-sm font-medium text-danger-text transition-colors hover:bg-[#F6DCD3] disabled:cursor-not-allowed disabled:opacity-50'

const timeValue = (value) => (value ? formatTime(value) : '')

function toMinutes(time) {
  const [h, m] = String(time ?? '').split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN
}

function fromMinutes(total) {
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 59))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

function normalizeCourt(raw) {
  return {
    id: raw?.id,
    name: raw?.name ?? '',
    surfaceType: raw?.surfaceType ?? raw?.surface ?? '',
    pricePerHour: raw?.pricePerHour ?? raw?.price ?? '',
    openingTime: timeValue(raw?.openingTime ?? raw?.openTime),
    closingTime: timeValue(raw?.closingTime ?? raw?.closeTime),
    slotDurationMinutes: raw?.slotDurationMinutes ?? raw?.slotDuration ?? 60,
    isActive: raw?.isActive ?? !String(raw?.status ?? '').toLowerCase().includes('inactive'),
  }
}

function Switch({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-hairline-strong px-3.5 py-3 text-left"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-success-text' : 'bg-ink/15'}`}>
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  )
}

/* ---------------- Add / edit court ---------------- */

function CourtFormModal({ court, onClose, onSaved }) {
  const toast = useToast()
  const isEdit = Boolean(court?.id)

  const [form, setForm] = useState(() =>
    court
      ? { ...court, pricePerHour: String(court.pricePerHour ?? ''), slotDurationMinutes: String(court.slotDurationMinutes ?? 60) }
      : {
          name: '',
          surfaceType: 'Artificial turf',
          pricePerHour: '',
          openingTime: '06:00',
          closingTime: '21:00',
          slotDurationMinutes: '60',
          isActive: true,
        }
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    const name = form.name.trim()
    if (name.length < 2) next.name = 'Court name is required.'
    else if (name.length > 50) next.name = 'Name must be 50 characters or less.'

    const price = Number(form.pricePerHour)
    if (form.pricePerHour === '') next.pricePerHour = 'Price is required.'
    else if (!Number.isFinite(price) || price <= 0) next.pricePerHour = 'Enter a price above 0.'
    else if (price > 100000) next.pricePerHour = 'That price looks too high.'

    const open = toMinutes(form.openingTime)
    const close = toMinutes(form.closingTime)
    if (!form.openingTime) next.openingTime = 'Opening time is required.'
    if (!form.closingTime) next.closingTime = 'Closing time is required.'
    else if (!(close > open)) next.closingTime = 'Closing time must be after opening time.'
    else if (close - open < Number(form.slotDurationMinutes)) next.slotDurationMinutes = 'Opening hours are shorter than one slot.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    const payload = {
      name: form.name.trim(),
      surfaceType: form.surfaceType,
      pricePerHour: Number(form.pricePerHour),
      openingTime: form.openingTime,
      closingTime: form.closingTime,
      slotDurationMinutes: Number(form.slotDurationMinutes),
      isActive: form.isActive,
    }

    setSaving(true)
    try {
      if (isEdit) await ownerApi.updateCourt(court.id, payload)
      else await ownerApi.createCourt(payload)
      toast.success(isEdit ? 'Court updated' : 'Court added')
      onSaved()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save this court.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Edit court' : 'Add a court'}
      description="Players book slots based on these hours and prices."
      size="md"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="court-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Add court'}
          </Button>
        </>
      }
    >
      <form id="court-form" onSubmit={handleSubmit} noValidate className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="court-name" className="label">Court name</label>
          <input
            id="court-name"
            value={form.name}
            onChange={setField('name')}
            className={`input ${errors.name ? 'input-error' : ''}`}
            placeholder="e.g. Court A"
            maxLength={50}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="court-surface" className="label">Surface</label>
          <select id="court-surface" value={form.surfaceType} onChange={setField('surfaceType')} className="input">
            {SURFACES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="court-price" className="label">Price per hour (Rs)</label>
          <input
            id="court-price"
            type="number"
            inputMode="numeric"
            min="0"
            value={form.pricePerHour}
            onChange={setField('pricePerHour')}
            className={`input num ${errors.pricePerHour ? 'input-error' : ''}`}
            placeholder="1500"
          />
          {errors.pricePerHour && <p className="field-error">{errors.pricePerHour}</p>}
        </div>

        <div>
          <label htmlFor="court-open" className="label">Opens</label>
          <input
            id="court-open"
            type="time"
            step="1800"
            value={form.openingTime}
            onChange={setField('openingTime')}
            className={`input num ${errors.openingTime ? 'input-error' : ''}`}
          />
          {errors.openingTime && <p className="field-error">{errors.openingTime}</p>}
        </div>

        <div>
          <label htmlFor="court-close" className="label">Closes</label>
          <input
            id="court-close"
            type="time"
            step="1800"
            value={form.closingTime}
            onChange={setField('closingTime')}
            className={`input num ${errors.closingTime ? 'input-error' : ''}`}
          />
          {errors.closingTime && <p className="field-error">{errors.closingTime}</p>}
        </div>

        <div className="sm:col-span-2">
          <p className="label">Slot length</p>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((minutes) => {
              const active = String(minutes) === String(form.slotDurationMinutes)
              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setForm((f) => ({ ...f, slotDurationMinutes: String(minutes) }))
                    setErrors((err) => ({ ...err, slotDurationMinutes: undefined }))
                  }}
                  className={`h-11 rounded-xl border text-sm transition-colors ${
                    active ? 'border-ink bg-ink text-white' : 'border-hairline-strong hover:border-ink/40'
                  }`}
                >
                  <span className="num">{minutes}</span> min
                </button>
              )
            })}
          </div>
          {errors.slotDurationMinutes && <p className="field-error">{errors.slotDurationMinutes}</p>}
        </div>

        <div className="sm:col-span-2">
          <Switch
            checked={form.isActive}
            onChange={(isActive) => setForm((f) => ({ ...f, isActive }))}
            label="Open for booking"
            description="Turn off to hide this court from players."
          />
        </div>

        {formError && (
          <div role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text sm:col-span-2">
            {formError}
          </div>
        )}
      </form>
    </Modal>
  )
}

/* ---------------- Block a slot ---------------- */

function BlockSlotModal({ courts, defaultCourtId, onClose }) {
  const toast = useToast()
  const today = toDateInputValue()

  const [form, setForm] = useState(() => {
    const court = courts.find((c) => String(c.id) === String(defaultCourtId)) ?? courts[0]
    const start = court?.openingTime || '06:00'
    return {
      courtId: String(court?.id ?? ''),
      date: today,
      startTime: start,
      endTime: fromMinutes(toMinutes(start) + 60),
      reason: '',
    }
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const court = courts.find((c) => String(c.id) === form.courtId)

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    const start = toMinutes(form.startTime)
    const end = toMinutes(form.endTime)
    if (!form.courtId) next.courtId = 'Choose a court.'
    if (!form.date) next.date = 'Choose a date.'
    else if (form.date < today) next.date = "You can't block a date in the past."
    if (!form.startTime) next.startTime = 'Start time is required.'
    if (!form.endTime) next.endTime = 'End time is required.'
    else if (!(end > start)) next.endTime = 'End time must be after start time.'
    if (court?.openingTime && court?.closingTime && end > start) {
      if (start < toMinutes(court.openingTime) || end > toMinutes(court.closingTime)) {
        next.endTime = `Must be within court hours (${court.openingTime}–${court.closingTime}).`
      }
    }
    if (form.reason.length > 200) next.reason = 'Reason must be 200 characters or less.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setSaving(true)
    try {
      await ownerApi.blockSlot({
        courtId: asId(form.courtId),
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        reason: form.reason.trim() || 'Maintenance',
      })
      toast.success('Slot blocked')
      onClose()
    } catch (err) {
      setFormError(
        err?.response?.status === 409
          ? 'There is already a booking in that time. Cancel it first, then block the slot.'
          : getErrorMessage(err, 'Could not block this slot.')
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Block a slot"
      description="Blocked time can't be booked by players. Use it for maintenance or private events."
      size="md"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="block-form" variant="secondary" loading={saving}>
            Block slot
          </Button>
        </>
      }
    >
      <form id="block-form" onSubmit={handleSubmit} noValidate className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="block-court" className="label">Court</label>
          <select
            id="block-court"
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
          {court?.openingTime && (
            <p className="mt-1 text-xs text-muted">
              Hours <span className="num">{court.openingTime}–{court.closingTime}</span>
            </p>
          )}
          {errors.courtId && <p className="field-error">{errors.courtId}</p>}
        </div>

        <div>
          <label htmlFor="block-date" className="label">Date</label>
          <input
            id="block-date"
            type="date"
            min={today}
            value={form.date}
            onChange={setField('date')}
            className={`input num ${errors.date ? 'input-error' : ''}`}
          />
          {errors.date && <p className="field-error">{errors.date}</p>}
        </div>

        <div>
          <label htmlFor="block-start" className="label">From</label>
          <input
            id="block-start"
            type="time"
            step="1800"
            value={form.startTime}
            onChange={setField('startTime')}
            className={`input num ${errors.startTime ? 'input-error' : ''}`}
          />
          {errors.startTime && <p className="field-error">{errors.startTime}</p>}
        </div>

        <div>
          <label htmlFor="block-end" className="label">To</label>
          <input
            id="block-end"
            type="time"
            step="1800"
            value={form.endTime}
            onChange={setField('endTime')}
            className={`input num ${errors.endTime ? 'input-error' : ''}`}
          />
          {errors.endTime && <p className="field-error">{errors.endTime}</p>}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="block-reason" className="label">
            Reason <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="block-reason"
            value={form.reason}
            onChange={setField('reason')}
            className={`input ${errors.reason ? 'input-error' : ''}`}
            placeholder="e.g. Turf maintenance"
            maxLength={200}
          />
          {errors.reason && <p className="field-error">{errors.reason}</p>}
        </div>

        {formError && (
          <div role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text sm:col-span-2">
            {formError}
          </div>
        )}
      </form>
    </Modal>
  )
}

/* ---------------- Delete ---------------- */

function DeleteCourtModal({ court, onClose, onDeleted }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const handleDelete = async () => {
    setSaving(true)
    try {
      await ownerApi.deleteCourt(court.id)
      toast.success('Court deleted')
      onDeleted()
    } catch (err) {
      const status = err?.response?.status
      toast.error(
        status === 409 || status === 400
          ? getErrorMessage(err, 'This court has upcoming bookings. Deactivate it instead.')
          : getErrorMessage(err, 'Could not delete this court.')
      )
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={`Delete ${court.name}?`}
      description="Players will no longer see this court. This can't be undone."
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>
            Keep court
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={saving}>
            Delete
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        If the court has upcoming bookings, turn off <span className="font-medium text-ink">Open for booking</span> instead.
      </p>
    </Modal>
  )
}

/* ---------------- Page ---------------- */

export default function OwnerCourts() {
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ key: null, items: [], error: null })
  const loading = result.key !== reload

  useEffect(() => {
    let active = true
    ownerApi
      .courts()
      .then((data) => {
        if (active) setResult({ key: reload, items: toList(data).map(normalizeCourt), error: null })
      })
      .catch((err) => {
        if (active) setResult({ key: reload, items: [], error: getErrorMessage(err, 'Could not load courts.') })
      })
    return () => {
      active = false
    }
  }, [reload])

  const [editing, setEditing] = useState(null) // null | 'new' | court
  const [blocking, setBlocking] = useState(null) // null | { courtId }
  const [deleting, setDeleting] = useState(null)

  const courts = result.items
  const refresh = () => setReload((n) => n + 1)

  return (
    <>
      <PageHeader
        eyebrow="Setup"
        title="Courts"
        description="Set hours and prices for each court, or block time for maintenance."
        actions={
          <>
            <Button variant="soft" disabled={loading || !courts.length} onClick={() => setBlocking({ courtId: '' })}>
              Block a slot
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Icon name="plus" className="h-[18px] w-[18px]" />
              Add court
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-52 rounded-2xl" />
          ))}
        </div>
      ) : result.error ? (
        <div className="rounded-2xl border bg-surface px-5 py-12 text-center">
          <StatusPill variant="danger">Error</StatusPill>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">{result.error}</p>
          <Button variant="soft" size="sm" className="mt-4" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : courts.length === 0 ? (
        <div className="rounded-2xl border bg-surface px-5 py-14 text-center">
          <div aria-hidden="true" className="stripes mx-auto h-16 w-16 rounded-full border" />
          <p className="mt-4 text-[15px] font-medium">No courts yet</p>
          <p className="mt-1 text-sm text-muted">Add your first court so players can start booking.</p>
          <Button className="mt-5" onClick={() => setEditing('new')}>
            <Icon name="plus" className="h-[18px] w-[18px]" />
            Add court
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {courts.map((court) => (
            <article key={court.id} className="flex flex-col rounded-2xl border bg-surface">
              <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div className="min-w-0">
                  <p className="eyebrow truncate">{court.surfaceType || 'Court'}</p>
                  <h3 className="mt-1 truncate text-lg font-semibold">{court.name}</h3>
                </div>
                <StatusPill variant={court.isActive ? 'success' : 'neutral'}>
                  {court.isActive ? 'Open' : 'Closed'}
                </StatusPill>
              </div>

              <dl className="mx-5 mt-4 grid grid-cols-3 divide-x divide-hairline rounded-xl bg-canvas">
                <div className="px-3 py-2.5">
                  <dt className="eyebrow">Price/hr</dt>
                  <dd className="num mt-1 text-sm">{formatNPR(court.pricePerHour)}</dd>
                </div>
                <div className="px-3 py-2.5">
                  <dt className="eyebrow">Hours</dt>
                  <dd className="num mt-1 text-sm">
                    {court.openingTime ? `${court.openingTime}–${court.closingTime}` : '—'}
                  </dd>
                </div>
                <div className="px-3 py-2.5">
                  <dt className="eyebrow">Slot</dt>
                  <dd className="mt-1 text-sm">
                    <span className="num">{court.slotDurationMinutes}</span> min
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2 border-t px-5 py-3">
                <Button size="sm" variant="soft" onClick={() => setEditing(court)}>
                  Edit
                </Button>
                <Button size="sm" variant="soft" onClick={() => setBlocking({ courtId: court.id })}>
                  Block slot
                </Button>
                <button type="button" className={`${DANGER_SOFT} ml-auto`} onClick={() => setDeleting(court)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <CourtFormModal
          court={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}

      {blocking && courts.length > 0 && (
        <BlockSlotModal courts={courts} defaultCourtId={blocking.courtId} onClose={() => setBlocking(null)} />
      )}

      {deleting && (
        <DeleteCourtModal
          court={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            refresh()
          }}
        />
      )}
    </>
  )
}