import { useEffect, useState } from 'react'
import Button from '../../components/Button.jsx'
import Card from '../../components/Card.jsx'
import DataTable from '../../components/DataTable.jsx'
import GrowthChart from '../../components/GrowthChart.jsx'
import KpiCard from '../../components/KpiCard.jsx'
import { Icon, PageHeader } from '../../components/SidebarNav.jsx'
import StatusPill from '../../components/StatusPill.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useAuth } from '../../Context/AuthContext.jsx'
import {
  formatDay,
  formatNPR,
  formatTime,
  getErrorMessage,
  normalizeBooking,
  ownerApi,
  toDateInputValue,
  toList,
} from '../../services/api.js'

function pick(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key]
  }
  return undefined
}

function normalizeDashboard(data) {
  const d = data ?? {}
  const k = d.kpis ?? d.stats ?? d
  const todayRaw = pick(d, ['todaysBookings', 'todayBookingsList', 'todayBookings'])
  const pending = toList(pick(d, ['pendingCashPayments', 'pendingPayments', 'unpaidBookings']))
    .map(normalizeBooking)
    .filter(Boolean)

  return {
    todayCount: Array.isArray(todayRaw)
      ? todayRaw.length
      : pick(k, ['todayBookingsCount', 'todayBookings', 'bookingsToday']),
    monthBookings: pick(k, ['monthBookings', 'bookingsThisMonth', 'totalBookings']),
    monthRevenue: pick(k, ['monthRevenue', 'revenueThisMonth', 'totalRevenue']),
    pendingCashAmount:
      pick(k, ['pendingCashAmount', 'pendingAmount', 'unpaidAmount']) ??
      pending.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
    averageRating: pick(k, ['averageRating', 'rating']),
    bookingsDelta: pick(k, ['bookingsGrowth', 'bookingsDelta']),
    revenueDelta: pick(k, ['revenueGrowth', 'revenueDelta']),
    growth: toList(pick(d, ['growth', 'growthChart', 'revenueChart', 'chart'])),
    pending,
    today: Array.isArray(todayRaw) ? todayRaw.map(normalizeBooking).filter(Boolean) : [],
  }
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function OwnerDashboard() {
  const toast = useToast()
  const { getSession } = useAuth()
  const user = getSession('owner')?.user
  const firstName = String(user?.fullName ?? user?.name ?? '').trim().split(' ')[0]

  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ key: null, data: null, error: null })
  const [markingId, setMarkingId] = useState(null)
  const loading = result.key !== reload

  useEffect(() => {
    let active = true
    ownerApi
      .dashboard()
      .then((data) => {
        if (active) setResult({ key: reload, data: normalizeDashboard(data), error: null })
      })
      .catch((err) => {
        if (active) setResult({ key: reload, data: null, error: getErrorMessage(err, 'Could not load your dashboard.') })
      })
    return () => {
      active = false
    }
  }, [reload])

  const markPaid = async (booking) => {
    setMarkingId(booking.id)
    try {
      await ownerApi.markPaid(booking.id)
      setResult((r) =>
        r.data
          ? {
              ...r,
              data: {
                ...r.data,
                pending: r.data.pending.filter((b) => b.id !== booking.id),
                pendingCashAmount: Math.max(0, Number(r.data.pendingCashAmount || 0) - Number(booking.amount || 0)),
                today: r.data.today.map((b) => (b.id === booking.id ? { ...b, paymentStatus: 'Paid' } : b)),
              },
            }
          : r
      )
      toast.success(`${booking.playerName || 'Booking'} marked as paid`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not mark as paid.'))
    } finally {
      setMarkingId(null)
    }
  }

  const header = (
    <PageHeader
      eyebrow={formatDay(toDateInputValue())}
      title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
      description="Here's how your venue is doing."
      actions={
        <>
          <Button variant="soft" to="/owner/bookings">
            View bookings
          </Button>
          <Button to="/owner/bookings?new=1">
            <Icon name="plus" className="h-[18px] w-[18px]" />
            New booking
          </Button>
        </>
      }
    />
  )

  if (!loading && result.error) {
    return (
      <>
        {header}
        <div className="rounded-2xl border bg-surface px-5 py-12 text-center">
          <StatusPill variant="danger">Error</StatusPill>
          <p className="mt-3 text-[15px] font-medium">Couldn't load your dashboard</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{result.error}</p>
          <Button variant="soft" size="sm" className="mt-4" onClick={() => setReload((n) => n + 1)}>
            Try again
          </Button>
        </div>
      </>
    )
  }

  const d = loading ? null : result.data

  const todayColumns = [
    {
      key: 'time',
      header: 'Time',
      render: (b) => (
        <span className="num">
          {formatTime(b.startTime)}–{formatTime(b.endTime)}
        </span>
      ),
    },
    {
      key: 'player',
      header: 'Player',
      render: (b) => (
        <div>
          <p className="font-medium">{b.playerName || '—'}</p>
          <p className="num text-xs text-muted">{b.contactNumber || '—'}</p>
        </div>
      ),
    },
    { key: 'court', header: 'Court', hideBelow: 'md', render: (b) => b.courtName || '—' },
    { key: 'ref', header: 'Ref', hideBelow: 'lg', mono: true, render: (b) => b.referenceCode || '—' },
    { key: 'amount', header: 'Amount', align: 'right', render: (b) => formatNPR(b.amount) },
    { key: 'payment', header: 'Payment', hideBelow: 'sm', render: (b) => <StatusPill status={b.paymentStatus || 'Unpaid'} /> },
    { key: 'status', header: 'Status', render: (b) => <StatusPill status={b.status} /> },
  ]

  return (
    <>
      {header}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Today's bookings" value={d?.todayCount} loading={loading} icon={<Icon name="calendar" className="h-4 w-4" />} />
        <KpiCard
          label="Bookings this month"
          value={d?.monthBookings}
          delta={d?.bookingsDelta}
          hint={d?.bookingsDelta != null ? 'vs last month' : undefined}
          loading={loading}
          icon={<Icon name="trend" className="h-4 w-4" />}
        />
        <KpiCard
          label="Revenue this month"
          value={d?.monthRevenue}
          format="currency"
          delta={d?.revenueDelta}
          hint={d?.revenueDelta != null ? 'vs last month' : undefined}
          loading={loading}
          icon={<Icon name="receipt" className="h-4 w-4" />}
        />
        <KpiCard
          label="Pending cash"
          value={d?.pendingCashAmount}
          format="currency"
          hint={d ? `${d.pending.length} unpaid ${d.pending.length === 1 ? 'booking' : 'bookings'}` : undefined}
          loading={loading}
          icon={<Icon name="cash" className="h-4 w-4" />}
        />
      </div>

      {/* Chart + pending */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <GrowthChart
          className="xl:col-span-2"
          eyebrow="Performance"
          title="Growth"
          data={d?.growth}
          loading={loading}
        />

        <Card
          eyebrow="Collect at venue"
          title="Pending cash payments"
          padding="none"
          action={d && d.pending.length > 0 ? <StatusPill variant="warning">{d.pending.length} unpaid</StatusPill> : null}
        >
          {loading ? (
            <div className="space-y-4 px-5 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-4 w-28" />
                    <div className="skeleton h-3 w-36" />
                  </div>
                  <div className="skeleton h-9 w-20 rounded-xl" />
                </div>
              ))}
            </div>
          ) : d.pending.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-success-bg text-success-text">
                <Icon name="check" className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-medium">All caught up</p>
              <p className="mt-0.5 text-sm text-muted">No unpaid cash bookings.</p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {d.pending.slice(0, 6).map((b) => (
                <li key={b.id ?? b.referenceCode} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.playerName || 'Player'}</p>
                    <p className="truncate text-xs text-muted">
                      <span className="num">
                        {formatDay(b.date)} · {formatTime(b.startTime)}
                      </span>
                      {b.courtName ? ` · ${b.courtName}` : ''}
                    </p>
                  </div>
                  <p className="num shrink-0 text-sm">{formatNPR(b.amount)}</p>
                  <Button size="sm" variant="soft" loading={markingId === b.id} onClick={() => markPaid(b)}>
                    Mark paid
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Today */}
      <div className="mt-4">
        <DataTable
          toolbar={
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Schedule</p>
                <h3 className="mt-0.5 text-base font-semibold">Today's bookings</h3>
              </div>
              <Button size="sm" variant="soft" to="/owner/bookings">
                Open schedule
              </Button>
            </div>
          }
          columns={todayColumns}
          data={d?.today ?? []}
          loading={loading}
          rowKey={(b, i) => b.id ?? b.referenceCode ?? i}
          emptyMessage="No bookings today yet."
          minWidth={760}
        />
      </div>
    </>
  )
}