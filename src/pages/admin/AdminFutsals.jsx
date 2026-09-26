import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button.jsx'
import DataTable from '../../components/DataTable.jsx'
import Modal from '../../components/Modal.jsx'
import { Stars } from '../../components/ReviewCard.jsx'
import { PageHeader } from '../../components/SidebarNav.jsx'
import StatusPill from '../../components/StatusPill.jsx'
import Pagination, { FilterChip, SearchInput, usePagination } from '../../components/TableControls.jsx'
import { useToast } from '../../components/Toast.jsx'
import { adminApi, formatNumber, getErrorMessage, toList } from '../../services/api.js'

const DANGER_SOFT =
  'inline-flex h-9 items-center justify-center rounded-xl bg-danger-bg px-3.5 text-sm font-medium text-danger-text transition-colors hover:bg-[#F6DCD3] disabled:cursor-not-allowed disabled:opacity-50'
const SUCCESS_SOFT =
  'inline-flex h-9 items-center justify-center rounded-xl bg-success-bg px-3.5 text-sm font-medium text-success-text transition-colors hover:bg-[#D9EDE2] disabled:cursor-not-allowed disabled:opacity-50'

function normalizeFutsal(raw) {
  return {
    id: raw?.id,
    name: raw?.name ?? '',
    city: raw?.city ?? '',
    address: raw?.address ?? '',
    ownerName: raw?.ownerName ?? raw?.owner?.fullName ?? raw?.owner?.name ?? '',
    ownerEmail: raw?.ownerEmail ?? raw?.owner?.email ?? '',
    courtCount: raw?.courtCount ?? (Array.isArray(raw?.courts) ? raw.courts.length : undefined),
    rating: Number(raw?.averageRating ?? raw?.rating) || 0,
    reviewCount: raw?.reviewCount ?? 0,
    bookingCount: raw?.bookingCount ?? raw?.totalBookings,
    isActive: raw?.isActive ?? !String(raw?.status ?? '').toLowerCase().includes('inactive'),
  }
}

function FutsalStatusModal({ futsal, onClose, onChanged }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const publishing = !futsal.isActive

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await adminApi.setFutsalStatus(futsal.id, publishing)
      toast.success(publishing ? 'Listing is live' : 'Listing hidden')
      onChanged(futsal.id, publishing)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update this listing.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={publishing ? `Publish ${futsal.name}?` : `Hide ${futsal.name}?`}
      description={
        publishing
          ? 'The venue will appear in search and accept bookings again.'
          : "Players won't see this venue or be able to book it. Existing bookings are not changed."
      }
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant={publishing ? 'secondary' : 'danger'} onClick={handleConfirm} loading={saving}>
            {publishing ? 'Publish' : 'Hide listing'}
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-canvas px-4 py-3">
        <p className="text-sm font-medium">{futsal.name}</p>
        <p className="text-sm text-muted">{[futsal.address, futsal.city].filter(Boolean).join(', ') || '—'}</p>
        {futsal.ownerName && <p className="mt-1 text-sm text-muted">Owner: {futsal.ownerName}</p>}
      </div>
    </Modal>
  )
}

export default function AdminFutsals() {
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ key: null, items: [], error: null })
  const loading = result.key !== reload

  useEffect(() => {
    let active = true
    adminApi
      .futsals()
      .then((data) => {
        if (active) setResult({ key: reload, items: toList(data).map(normalizeFutsal), error: null })
      })
      .catch((err) => {
        if (active) setResult({ key: reload, items: [], error: getErrorMessage(err, 'Could not load futsals.') })
      })
    return () => {
      active = false
    }
  }, [reload])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [city, setCity] = useState('')
  const [target, setTarget] = useState(null)

  const futsals = result.items
  const cities = useMemo(() => [...new Set(futsals.map((f) => f.city).filter(Boolean))].sort(), [futsals])

  const counts = useMemo(
    () => ({
      all: futsals.length,
      live: futsals.filter((f) => f.isActive).length,
      hidden: futsals.filter((f) => !f.isActive).length,
    }),
    [futsals]
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return futsals
      .filter((f) => (statusFilter === 'live' ? f.isActive : statusFilter === 'hidden' ? !f.isActive : true))
      .filter((f) => !city || f.city === city)
      .filter(
        (f) => !q || [f.name, f.address, f.city, f.ownerName, f.ownerEmail].some((v) => String(v).toLowerCase().includes(q))
      )
  }, [futsals, search, statusFilter, city])

  const pager = usePagination(rows, 15, `${search}|${statusFilter}|${city}|${reload}`)

  const handleChanged = (id, isActive) => {
    setTarget(null)
    setResult((r) => ({ ...r, items: r.items.map((f) => (f.id === id ? { ...f, isActive } : f)) }))
  }

  const columns = [
    {
      key: 'venue',
      header: 'Venue',
      render: (f) => (
        <div className="min-w-0">
          <p className="font-medium">{f.name || '—'}</p>
          <p className="text-xs text-muted">{f.address || '—'}</p>
        </div>
      ),
    },
    { key: 'city', header: 'City', hideBelow: 'md', render: (f) => f.city || '—' },
    {
      key: 'owner',
      header: 'Owner',
      hideBelow: 'lg',
      render: (f) => (
        <div>
          <p>{f.ownerName || '—'}</p>
          {f.ownerEmail && <p className="text-xs text-muted">{f.ownerEmail}</p>}
        </div>
      ),
    },
    { key: 'courts', header: 'Courts', align: 'right', hideBelow: 'md', render: (f) => formatNumber(f.courtCount) },
    {
      key: 'rating',
      header: 'Rating',
      hideBelow: 'xl',
      render: (f) =>
        f.rating > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Stars value={f.rating} />
            <span className="num text-xs text-muted">
              {f.rating.toFixed(1)} ({f.reviewCount})
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted">No reviews</span>
        ),
    },
    { key: 'bookings', header: 'Bookings', align: 'right', hideBelow: 'xl', render: (f) => formatNumber(f.bookingCount) },
    {
      key: 'status',
      header: 'Status',
      render: (f) => <StatusPill variant={f.isActive ? 'success' : 'warning'}>{f.isActive ? 'Live' : 'Hidden'}</StatusPill>,
    },
    {
      key: 'actions',
      header: '',
      render: (f) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="soft" to={`/futsals/${f.id}`} target="_blank" rel="noreferrer">
            View
          </Button>
          <button type="button" className={f.isActive ? DANGER_SOFT : SUCCESS_SOFT} onClick={() => setTarget(f)}>
            {f.isActive ? 'Hide' : 'Publish'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Listings"
        title="Futsals"
        description="Control which venues players can see and book. New futsals are added from the Owners page."
        actions={
          <Button variant="soft" to="/admin/owners?new=1">
            Add new futsal
          </Button>
        }
      />

      <DataTable
        toolbar={
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <SearchInput value={search} onChange={setSearch} placeholder="Venue, address or owner" className="sm:w-72" />
              <select
                aria-label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input h-10 w-auto py-0 text-sm"
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} count={counts.all}>
                All
              </FilterChip>
              <FilterChip active={statusFilter === 'live'} onClick={() => setStatusFilter('live')} count={counts.live}>
                Live
              </FilterChip>
              <FilterChip active={statusFilter === 'hidden'} onClick={() => setStatusFilter('hidden')} count={counts.hidden}>
                Hidden
              </FilterChip>
            </div>
          </div>
        }
        footer={
          !loading && !result.error && rows.length > 0 ? <Pagination {...pager} onPageChange={pager.setPage} /> : null
        }
        columns={columns}
        data={pager.pageItems}
        loading={loading}
        error={result.error}
        onRetry={() => setReload((n) => n + 1)}
        emptyMessage={futsals.length ? 'No futsals match your filters.' : 'No futsals on the platform yet.'}
        minWidth={820}
      />

      {target && <FutsalStatusModal futsal={target} onClose={() => setTarget(null)} onChanged={handleChanged} />}
    </>
  )
}