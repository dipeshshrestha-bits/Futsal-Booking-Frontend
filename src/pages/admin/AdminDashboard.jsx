import { useEffect, useState } from 'react'
import Button from '../../components/Button.jsx'
import Card from '../../components/Card.jsx'
import DataTable from '../../components/DataTable.jsx'
import GrowthChart from '../../components/GrowthChart.jsx'
import KpiCard from '../../components/KpiCard.jsx'
import { Icon, PageHeader } from '../../components/SidebarNav.jsx'
import StatusPill from '../../components/StatusPill.jsx'
import { useAuth } from '../../Context/AuthContext.jsx'
import {
  adminApi,
  formatDateTime,
  formatDay,
  formatNPR,
  formatNumber,
  getErrorMessage,
  toDateInputValue,
  toList,
} from '../../services/api.js'

function pick(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key]
  }
  return undefined
}

function normalizeActivity(raw, i) {
  return {
    id: raw?.id ?? i,
    type: String(raw?.type ?? raw?.category ?? ''),
    title: raw?.title ?? raw?.message ?? raw?.description ?? 'Activity',
    detail: raw?.detail ?? raw?.futsalName ?? '',
    amount: raw?.amount,
    createdAt: raw?.createdAt ?? raw?.timestamp ?? raw?.date,
  }
}

function normalizeDashboard(data) {
  const d = data ?? {}
  const k = d.kpis ?? d.stats ?? d
  return {
    totalFutsals: pick(k, ['totalFutsals', 'futsalCount']),
    activeFutsals: pick(k, ['activeFutsals', 'liveFutsals']),
    totalOwners: pick(k, ['totalOwners', 'ownerCount']),
    activeOwners: pick(k, ['activeOwners']),
    monthBookings: pick(k, ['monthBookings', 'bookingsThisMonth', 'totalBookings']),
    bookingsDelta: pick(k, ['bookingsGrowth', 'bookingsDelta']),
    monthRevenue: pick(k, ['monthRevenue', 'revenueThisMonth', 'totalRevenue']),
    revenueDelta: pick(k, ['revenueGrowth', 'revenueDelta']),
    growth: toList(pick(d, ['growth', 'growthChart', 'chart'])),
    activity: toList(pick(d, ['recentActivity', 'activity', 'activities'])).map(normalizeActivity),
    topFutsals: toList(pick(d, ['topFutsals', 'topVenues'])).map((f, i) => ({
      id: f?.id ?? i,
      name: f?.name ?? f?.futsalName ?? '—',
      city: f?.city ?? '',
      bookings: f?.bookingCount ?? f?.bookings ?? f?.totalBookings,
      revenue: f?.revenue ?? f?.totalRevenue,
    })),
  }
}

const DOTS = {
  success: 'bg-success-text',
  danger: 'bg-danger-text',
  info: 'bg-info-text',
  warning: 'bg-warning-text',
  neutral: 'bg-faint',
}

function activityVariant(item) {
  const s = `${item.type} ${item.title}`.toLowerCase()
  if (/(cancel|fail|refund|deactiv|hidden)/.test(s)) return 'danger'
  if (/(payment|paid|esewa)/.test(s)) return 'success'
  if (/(owner|futsal|venue|listing|activat|creat)/.test(s)) return 'info'
  if (/(pending|unpaid)/.test(s)) return 'warning'
  return 'neutral'
}

function timeAgo(value) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return '—'
  const seconds = Math.round((Date.now() - time) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDateTime(value)
}

export default function AdminDashboard() {
  const { getSession } = useAuth()
  const user = getSession('admin')?.user
  const firstName = String(user?.fullName ?? user?.name ?? '').trim().split(' ')[0]

  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ key: null, data: null, error: null })
  const loading = result.key !== reload

  useEffect(() => {
    let active = true
    adminApi
      .dashboard()
      .then((data) => {
        if (active) setResult({ key: reload, data: normalizeDashboard(data), error: null })
      })
      .catch((err) => {
        if (active) setResult({ key: reload, data: null, error: getErrorMessage(err, 'Could not load the dashboard.') })
      })
    return () => {
      active = false
    }
  }, [reload])

  const header = (
    <PageHeader
      eyebrow={formatDay(toDateInputValue())}
      title={firstName ? `Welcome back, ${firstName}` : 'Platform overview'}
      description="Live numbers across every venue on the platform."
      actions={
        <>
          <Button variant="soft" to="/admin/transactions">
            Transactions
          </Button>
          <Button variant="admin" to="/admin/owners?new=1">
            <Icon name="plus" className="h-[18px] w-[18px]" />
            Add new futsal
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
          <p className="mt-3 text-[15px] font-medium">Couldn't load the dashboard</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{result.error}</p>
          <Button variant="soft" size="sm" className="mt-4" onClick={() => setReload((n) => n + 1)}>
            Try again
          </Button>
        </div>
      </>
    )
  }

  const d = loading ? null : result.data

  const topColumns = [
    {
      key: 'rank',
      header: '#',
      mono: true,
      render: (_, i) => <span className="text-muted">{String(i + 1).padStart(2, '0')}</span>,
    },
    {
      key: 'name',
      header: 'Venue',
      render: (f) => (
        <div>
          <p className="font-medium">{f.name}</p>
          {f.city && <p className="text-xs text-muted">{f.city}</p>}
        </div>
      ),
    },
    { key: 'bookings', header: 'Bookings', align: 'right', render: (f) => formatNumber(f.bookings) },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (f) => formatNPR(f.revenue) },
  ]

  return (
    <>
      {header}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Live futsals"
          value={d?.activeFutsals ?? d?.totalFutsals}
          hint={d?.totalFutsals != null ? `of ${formatNumber(d.totalFutsals)} total` : undefined}
          loading={loading}
          icon={<Icon name="pitch" className="h-4 w-4" />}
        />
        <KpiCard
          label="Owners"
          value={d?.totalOwners}
          hint={d?.activeOwners != null ? `${formatNumber(d.activeOwners)} active` : undefined}
          loading={loading}
          icon={<Icon name="users" className="h-4 w-4" />}
        />
        <KpiCard
          label="Bookings this month"
          value={d?.monthBookings}
          delta={d?.bookingsDelta}
          hint={d?.bookingsDelta != null ? 'vs last month' : undefined}
          loading={loading}
          icon={<Icon name="calendar" className="h-4 w-4" />}
        />
        <KpiCard
          label="Revenue this month"
          value={d?.monthRevenue}
          format="currency"
          delta={d?.revenueDelta}
          hint={d?.revenueDelta != null ? 'vs last month' : 'Platform-wide'}
          loading={loading}
          icon={<Icon name="receipt" className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <GrowthChart
          className="xl:col-span-2"
          eyebrow="Platform"
          title="Growth"
          color="#3E6B87"
          data={d?.growth}
          loading={loading}
        />

        <Card eyebrow="Live feed" title="Recent activity" padding="none">
          {loading ? (
            <div className="space-y-4 px-5 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="skeleton mt-1 h-2 w-2 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-4 w-44" />
                    <div className="skeleton h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : d.activity.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted">No recent activity.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {d.activity.slice(0, 8).map((item) => (
                <li key={item.id} className="flex gap-3 px-5 py-3">
                  <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOTS[activityVariant(item)]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{item.title}</p>
                    <p className="truncate text-xs text-muted">
                      <span className="num">{timeAgo(item.createdAt)}</span>
                      {item.detail ? ` · ${item.detail}` : ''}
                    </p>
                  </div>
                  {item.amount != null && <p className="num shrink-0 text-sm">{formatNPR(item.amount)}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <DataTable
          toolbar={
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Leaderboard</p>
                <h3 className="mt-0.5 text-base font-semibold">Top venues this month</h3>
              </div>
              <Button size="sm" variant="soft" to="/admin/futsals">
                All futsals
              </Button>
            </div>
          }
          columns={topColumns}
          data={d?.topFutsals ?? []}
          loading={loading}
          emptyMessage="No venue data yet."
          minWidth={480}
        />
      </div>
    </>
  )
}