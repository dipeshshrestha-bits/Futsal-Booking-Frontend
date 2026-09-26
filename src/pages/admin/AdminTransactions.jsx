import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button.jsx'
import DataTable from '../../components/DataTable.jsx'
import { PageHeader } from '../../components/SidebarNav.jsx'
import StatusPill, { statusVariant } from '../../components/StatusPill.jsx'
import Pagination, { DateRangeFilter, SearchInput, rangeForPreset, usePagination } from '../../components/TableControls.jsx'
import { useToast } from '../../components/Toast.jsx'
import {
  adminApi,
  formatDateTime,
  formatNPR,
  getErrorMessage,
  toDateInputValue,
  toList,
} from '../../services/api.js'

const METHOD_OPTIONS = [
  { value: '', label: 'All methods' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Esewa', label: 'eSewa' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Success', label: 'Success' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Refunded', label: 'Refunded' },
]

const methodLabel = (m) => (String(m).toLowerCase() === 'esewa' ? 'eSewa' : m || '—')

function normalizeTransaction(raw, i) {
  return {
    id: raw?.id ?? i,
    transactionCode: raw?.transactionCode ?? raw?.transactionId ?? raw?.gatewayReference ?? raw?.refId ?? '',
    referenceCode: raw?.bookingReference ?? raw?.referenceCode ?? raw?.booking?.referenceCode ?? '',
    futsalName: raw?.futsalName ?? raw?.futsal?.name ?? raw?.booking?.futsalName ?? '',
    playerName: raw?.playerName ?? raw?.booking?.playerName ?? '',
    amount: raw?.amount ?? raw?.totalAmount,
    method: raw?.paymentMethod ?? raw?.method ?? '',
    status: raw?.status ?? raw?.paymentStatus ?? '',
    createdAt: raw?.paidAt ?? raw?.createdAt ?? raw?.date,
  }
}

function downloadCsv(rows) {
  const header = ['Date', 'Transaction', 'Booking ref', 'Venue', 'Player', 'Method', 'Status', 'Amount']
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const lines = [
    header,
    ...rows.map((t) => [
      formatDateTime(t.createdAt),
      t.transactionCode,
      t.referenceCode,
      t.futsalName,
      t.playerName,
      methodLabel(t.method),
      t.status,
      t.amount ?? '',
    ]),
  ].map((row) => row.map(escape).join(','))

  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `transactions-${toDateInputValue()}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function AdminTransactions() {
  const toast = useToast()
  const [range, setRange] = useState(() => rangeForPreset('30d'))
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const [reload, setReload] = useState(0)
  const apiParams = useMemo(() => {
    const params = {}
    if (range.from) params.from = range.from
    if (range.to) params.to = range.to
    if (method) params.method = method
    if (status) params.status = status
    return params
  }, [range, method, status])

  const requestKey = `${JSON.stringify(apiParams)}#${reload}`
  const [result, setResult] = useState({ key: null, items: [], error: null })
  const loading = result.key !== requestKey

  useEffect(() => {
    let active = true
    adminApi
      .transactions(apiParams)
      .then((data) => {
        if (active) setResult({ key: requestKey, items: toList(data).map(normalizeTransaction), error: null })
      })
      .catch((err) => {
        if (active) setResult({ key: requestKey, items: [], error: getErrorMessage(err, 'Could not load transactions.') })
      })
    return () => {
      active = false
    }
  }, [apiParams, requestKey])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return result.items
      .filter(
        (t) =>
          !q ||
          [t.transactionCode, t.referenceCode, t.futsalName, t.playerName].some((v) => String(v ?? '').toLowerCase().includes(q))
      )
      .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0))
  }, [result.items, search])

  const totals = useMemo(() => {
    const successful = rows.filter((t) => statusVariant(t.status) === 'success')
    const sum = (list) => list.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
    return {
      collected: sum(successful),
      esewa: sum(successful.filter((t) => String(t.method).toLowerCase() === 'esewa')),
      cash: sum(successful.filter((t) => String(t.method).toLowerCase() === 'cash')),
      problems: rows.filter((t) => statusVariant(t.status) === 'danger').length,
    }
  }, [rows])

  const pager = usePagination(rows, 20, `${requestKey}|${search}`)

  const handleExport = () => {
    if (!rows.length) {
      toast.info('Nothing to export for these filters.')
      return
    }
    downloadCsv(rows)
    toast.success(`Exported ${rows.length} transactions`)
  }

  const columns = [
    { key: 'date', header: 'Date', mono: true, render: (t) => formatDateTime(t.createdAt) },
    {
      key: 'txn',
      header: 'Transaction',
      render: (t) => (
        <div>
          <p className="num text-sm">{t.transactionCode || '—'}</p>
          {t.referenceCode && <p className="num text-xs text-muted">Booking {t.referenceCode}</p>}
        </div>
      ),
    },
    {
      key: 'venue',
      header: 'Venue',
      hideBelow: 'md',
      render: (t) => (
        <div>
          <p>{t.futsalName || '—'}</p>
          {t.playerName && <p className="text-xs text-muted">{t.playerName}</p>}
        </div>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      hideBelow: 'sm',
      render: (t) => (
        <StatusPill variant={String(t.method).toLowerCase() === 'esewa' ? 'info' : 'neutral'} dot={false}>
          {methodLabel(t.method)}
        </StatusPill>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (t) => formatNPR(t.amount) },
    { key: 'status', header: 'Status', render: (t) => <StatusPill status={t.status} /> },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Transactions"
        description="Payment records across the platform, including eSewa and cash collected at venues."
        actions={
          <Button variant="soft" onClick={handleExport} disabled={loading || Boolean(result.error)}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border bg-surface p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        <div className="flex flex-wrap gap-2">
          <select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)} className="input h-10 w-auto py-0 text-sm">
            {METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="input h-10 w-auto py-0 text-sm">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 divide-hairline rounded-2xl border bg-surface sm:grid-cols-4 sm:divide-x">
        <div className="px-4 py-3">
          <p className="eyebrow">Collected</p>
          <p className="num mt-1 text-lg font-medium text-success-text">{loading ? '—' : formatNPR(totals.collected)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="eyebrow">eSewa</p>
          <p className="num mt-1 text-lg font-medium">{loading ? '—' : formatNPR(totals.esewa)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="eyebrow">Cash</p>
          <p className="num mt-1 text-lg font-medium">{loading ? '—' : formatNPR(totals.cash)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="eyebrow">Failed / refunded</p>
          <p className="num mt-1 text-lg font-medium text-danger-text">{loading ? '—' : totals.problems}</p>
        </div>
      </div>

      <DataTable
        toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Transaction, booking ref, venue or player" className="sm:w-96" />}
        footer={!loading && !result.error && rows.length > 0 ? <Pagination {...pager} onPageChange={pager.setPage} /> : null}
        columns={columns}
        data={pager.pageItems}
        loading={loading}
        error={result.error}
        onRetry={() => setReload((n) => n + 1)}
        emptyMessage="No transactions match these filters."
        minWidth={760}
      />
    </>
  )
}