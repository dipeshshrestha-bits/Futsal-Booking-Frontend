import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import DataTable from '../../components/DataTable.jsx'
import Modal from '../../components/Modal.jsx'
import { Icon, PageHeader } from '../../components/SidebarNav.jsx'
import StatusPill from '../../components/StatusPill.jsx'
import Pagination, { FilterChip, SearchInput, usePagination } from '../../components/TableControls.jsx'
import { useToast } from '../../components/Toast.jsx'
import {
  adminApi,
  formatDate,
  getErrorMessage,
  isValidNepalPhone,
  normalizePhone,
  toList,
} from '../../services/api.js'

const CITIES = ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Pokhara', 'Chitwan', 'Biratnagar', 'Butwal', 'Dharan']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DANGER_SOFT =
  'inline-flex h-9 items-center justify-center rounded-xl bg-danger-bg px-3.5 text-sm font-medium text-danger-text transition-colors hover:bg-[#F6DCD3] disabled:cursor-not-allowed disabled:opacity-50'
const SUCCESS_SOFT =
  'inline-flex h-9 items-center justify-center rounded-xl bg-success-bg px-3.5 text-sm font-medium text-success-text transition-colors hover:bg-[#D9EDE2] disabled:cursor-not-allowed disabled:opacity-50'

function normalizeOwner(raw) {
  return {
    id: raw?.id,
    fullName: raw?.fullName ?? raw?.name ?? '',
    email: raw?.email ?? '',
    phone: raw?.phoneNumber ?? raw?.phone ?? raw?.contactNumber ?? '',
    futsalName: raw?.futsalName ?? raw?.futsal?.name ?? '',
    city: raw?.city ?? raw?.futsal?.city ?? '',
    isActive: raw?.isActive ?? !String(raw?.status ?? '').toLowerCase().includes('inactive'),
    mustChangePassword: Boolean(raw?.mustChangePassword),
    createdAt: raw?.createdAt,
  }
}

function extractCredentials(response, fallbackEmail) {
  const src = response?.credentials ?? response
  return {
    email: src?.email ?? src?.username ?? response?.owner?.email ?? fallbackEmail ?? '',
    password: src?.temporaryPassword ?? src?.tempPassword ?? src?.generatedPassword ?? src?.password ?? '',
  }
}

/* ---------------- Credentials (shown once) ---------------- */

function CredentialRow({ label, value, onCopy, emphasize = false }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <dt className="eyebrow">{label}</dt>
        <dd className={`num mt-1 break-all ${emphasize ? 'text-lg font-medium tracking-wide' : 'text-sm'}`}>{value}</dd>
      </div>
      <Button variant="soft" size="sm" onClick={onCopy}>
        Copy
      </Button>
    </div>
  )
}

function CredentialsModal({ data, onClose }) {
  const toast = useToast()
  const [saved, setSaved] = useState(false)
  const loginUrl = `${window.location.origin}/owner/login`
  const hasPassword = Boolean(data.password)

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy. Select and copy it manually.')
    }
  }

  const copyAll = () =>
    copy(
      [
        `Futsal owner login${data.futsalName ? ` for ${data.futsalName}` : ''}`,
        `Login page: ${loginUrl}`,
        `Email: ${data.email}`,
        `Temporary password: ${data.password}`,
        'You will be asked to set a new password when you first sign in.',
      ].join('\n'),
      'Login details'
    )

  const canClose = saved || !hasPassword

  return (
    <Modal
      open
      onClose={() => canClose && onClose()}
      closeOnBackdrop={false}
      hideClose
      title={data.title}
      description={data.name ? `Login details for ${data.name}` : 'Share these login details with the owner.'}
      size="md"
      footer={
        <Button variant="secondary" disabled={!canClose} onClick={onClose}>
          Done
        </Button>
      }
    >
      {hasPassword ? (
        <>
          <div className="rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning-text">
            <span className="font-medium">Shown only once.</span> Copy these details now. The password can't be viewed
            again, but you can reset it later.
          </div>

          <dl className="mt-4 divide-y divide-hairline rounded-xl border">
            <CredentialRow label="Login page" value={loginUrl} onCopy={() => copy(loginUrl, 'Login link')} />
            <CredentialRow label="Email" value={data.email} onCopy={() => copy(data.email, 'Email')} />
            <CredentialRow
              label="Temporary password"
              value={data.password}
              emphasize
              onCopy={() => copy(data.password, 'Password')}
            />
          </dl>

          <p className="mt-3 text-sm text-muted">The owner must set a new password the first time they sign in.</p>

          <Button variant="soft" fullWidth className="mt-3" onClick={copyAll}>
            Copy all details
          </Button>

          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 accent-ink" />
            I've saved these details somewhere safe
          </label>
        </>
      ) : (
        <div className="rounded-xl bg-info-bg px-4 py-3 text-sm text-info-text">
          The action succeeded, but the server didn't return a temporary password. Check the backend response.
        </div>
      )}
    </Modal>
  )
}

/* ---------------- Create owner + futsal ---------------- */

function CreateOwnerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    futsalName: '',
    city: 'Kathmandu',
    address: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    const name = form.fullName.trim()
    if (name.length < 2) next.fullName = "Enter the owner's full name."
    else if (name.length > 80) next.fullName = 'Name must be 80 characters or less.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.phoneNumber.trim()) next.phoneNumber = 'Phone number is required.'
    else if (!isValidNepalPhone(form.phoneNumber)) next.phoneNumber = 'Enter a valid 10-digit mobile number.'
    const futsal = form.futsalName.trim()
    if (futsal.length < 2) next.futsalName = 'Enter the venue name.'
    else if (futsal.length > 100) next.futsalName = 'Venue name must be 100 characters or less.'
    if (!form.city.trim()) next.city = 'City is required.'
    if (!form.address.trim()) next.address = 'Address is required.'
    else if (form.address.trim().length > 200) next.address = 'Address must be 200 characters or less.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phoneNumber: normalizePhone(form.phoneNumber),
      futsalName: form.futsalName.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
    }

    setSaving(true)
    try {
      const response = await adminApi.createOwner(payload)
      onCreated(response, payload)
    } catch (err) {
      setFormError(
        err?.response?.status === 409
          ? 'An owner with this email already exists.'
          : getErrorMessage(err, 'Could not create this owner.')
      )
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Add new futsal"
      description="Creates the venue listing and its owner account. A temporary password is generated."
      size="lg"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="create-owner-form" variant="admin" loading={saving}>
            Create futsal & owner
          </Button>
        </>
      }
    >
      <form id="create-owner-form" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">Owner</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="co-name" className="label">Full name</label>
            <input
              id="co-name"
              value={form.fullName}
              onChange={setField('fullName')}
              className={`input ${errors.fullName ? 'input-error' : ''}`}
              placeholder="e.g. Ramesh Shrestha"
              maxLength={80}
            />
            {errors.fullName && <p className="field-error">{errors.fullName}</p>}
          </div>
          <div>
            <label htmlFor="co-email" className="label">Email (login)</label>
            <input
              id="co-email"
              type="email"
              inputMode="email"
              value={form.email}
              onChange={setField('email')}
              className={`input ${errors.email ? 'input-error' : ''}`}
              placeholder="owner@venue.com"
            />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="co-phone" className="label">Mobile number</label>
            <input
              id="co-phone"
              type="tel"
              inputMode="tel"
              value={form.phoneNumber}
              onChange={setField('phoneNumber')}
              className={`input num ${errors.phoneNumber ? 'input-error' : ''}`}
              placeholder="98XXXXXXXX"
              maxLength={16}
            />
            {errors.phoneNumber && <p className="field-error">{errors.phoneNumber}</p>}
          </div>
        </div>

        <p className="eyebrow mt-6">Venue</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="co-futsal" className="label">Futsal name</label>
            <input
              id="co-futsal"
              value={form.futsalName}
              onChange={setField('futsalName')}
              className={`input ${errors.futsalName ? 'input-error' : ''}`}
              placeholder="e.g. Dhuku Futsal Arena"
              maxLength={100}
            />
            {errors.futsalName && <p className="field-error">{errors.futsalName}</p>}
          </div>
          <div>
            <label htmlFor="co-city" className="label">City</label>
            <input
              id="co-city"
              list="co-city-options"
              value={form.city}
              onChange={setField('city')}
              className={`input ${errors.city ? 'input-error' : ''}`}
              maxLength={50}
            />
            <datalist id="co-city-options">
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {errors.city && <p className="field-error">{errors.city}</p>}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="co-address" className="label">Address</label>
            <input
              id="co-address"
              value={form.address}
              onChange={setField('address')}
              className={`input ${errors.address ? 'input-error' : ''}`}
              placeholder="e.g. Jhamsikhel Road, Lalitpur"
              maxLength={200}
            />
            {errors.address && <p className="field-error">{errors.address}</p>}
          </div>
        </div>

        {formError && (
          <div role="alert" className="mt-4 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">
            {formError}
          </div>
        )}
      </form>
    </Modal>
  )
}

/* ---------------- Activate / deactivate ---------------- */

function OwnerStatusModal({ owner, onClose, onChanged }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const activating = !owner.isActive

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await adminApi.setOwnerStatus(owner.id, activating)
      toast.success(activating ? 'Owner activated' : 'Owner deactivated')
      onChanged(owner.id, activating)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update this owner.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={activating ? `Activate ${owner.fullName}?` : `Deactivate ${owner.fullName}?`}
      description={
        activating
          ? 'They will be able to sign in to the owner dashboard again.'
          : "They won't be able to sign in to the owner dashboard until reactivated."
      }
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant={activating ? 'secondary' : 'danger'} onClick={handleConfirm} loading={saving}>
            {activating ? 'Activate' : 'Deactivate'}
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-canvas px-4 py-3">
        <p className="text-sm font-medium">{owner.futsalName || 'No venue name'}</p>
        <p className="text-sm text-muted">{owner.email}</p>
      </div>
    </Modal>
  )
}

/* ---------------- Reset password ---------------- */

function ResetPasswordModal({ owner, onClose, onReset }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const handleReset = async () => {
    setSaving(true)
    try {
      const response = await adminApi.resetOwnerPassword(owner.id)
      onReset(owner, extractCredentials(response, owner.email))
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not reset the password.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Reset password?"
      description="A new temporary password will be generated. The old password stops working immediately."
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleReset} loading={saving}>
            Reset password
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-canvas px-4 py-3">
        <p className="text-sm font-medium">{owner.fullName}</p>
        <p className="text-sm text-muted">{owner.email}</p>
      </div>
    </Modal>
  )
}

/* ---------------- Page ---------------- */

export default function AdminOwners() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ key: null, items: [], error: null })
  const loading = result.key !== reload

  useEffect(() => {
    let active = true
    adminApi
      .owners()
      .then((data) => {
        if (active) setResult({ key: reload, items: toList(data).map(normalizeOwner), error: null })
      })
      .catch((err) => {
        if (active) setResult({ key: reload, items: [], error: getErrorMessage(err, 'Could not load owners.') })
      })
    return () => {
      active = false
    }
  }, [reload])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(() => searchParams.get('new') === '1')
  const [statusTarget, setStatusTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [credentials, setCredentials] = useState(null)

  const owners = result.items

  const counts = useMemo(
    () => ({
      all: owners.length,
      active: owners.filter((o) => o.isActive).length,
      inactive: owners.filter((o) => !o.isActive).length,
    }),
    [owners]
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return owners
      .filter((o) => (statusFilter === 'active' ? o.isActive : statusFilter === 'inactive' ? !o.isActive : true))
      .filter(
        (o) => !q || [o.fullName, o.email, o.phone, o.futsalName, o.city].some((v) => String(v).toLowerCase().includes(q))
      )
  }, [owners, search, statusFilter])

  const pager = usePagination(rows, 15, `${search}|${statusFilter}|${reload}`)

  const closeCreate = () => {
    setCreateOpen(false)
    if (searchParams.get('new')) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('new')
          return next
        },
        { replace: true }
      )
    }
  }

  const handleCreated = (response, payload) => {
    closeCreate()
    toast.success(`${payload.futsalName} created`)
    setCredentials({
      title: 'Futsal created',
      name: payload.fullName,
      futsalName: payload.futsalName,
      ...extractCredentials(response, payload.email),
    })
    setReload((n) => n + 1)
  }

  const handleReset = (owner, creds) => {
    setResetTarget(null)
    setResult((r) => ({
      ...r,
      items: r.items.map((o) => (o.id === owner.id ? { ...o, mustChangePassword: true } : o)),
    }))
    setCredentials({ title: 'Password reset', name: owner.fullName, futsalName: owner.futsalName, ...creds })
  }

  const handleStatusChanged = (id, isActive) => {
    setStatusTarget(null)
    setResult((r) => ({ ...r, items: r.items.map((o) => (o.id === id ? { ...o, isActive } : o)) }))
  }

  const columns = [
    {
      key: 'owner',
      header: 'Owner',
      render: (o) => (
        <div className="min-w-0">
          <p className="font-medium">{o.fullName || '—'}</p>
          <p className="text-xs text-muted">{o.email}</p>
        </div>
      ),
    },
    {
      key: 'futsal',
      header: 'Futsal',
      render: (o) => (
        <div>
          <p>{o.futsalName || '—'}</p>
          {o.city && <p className="text-xs text-muted">{o.city}</p>}
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', hideBelow: 'lg', mono: true, render: (o) => o.phone || '—' },
    { key: 'joined', header: 'Joined', hideBelow: 'xl', mono: true, render: (o) => formatDate(o.createdAt) },
    {
      key: 'status',
      header: 'Status',
      render: (o) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill variant={o.isActive ? 'success' : 'danger'}>{o.isActive ? 'Active' : 'Inactive'}</StatusPill>
          {o.mustChangePassword && (
            <StatusPill variant="info" dot={false}>
              Temp password
            </StatusPill>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (o) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="soft" onClick={() => setResetTarget(o)}>
            Reset password
          </Button>
          <button
            type="button"
            className={o.isActive ? DANGER_SOFT : SUCCESS_SOFT}
            onClick={() => setStatusTarget(o)}
          >
            {o.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Accounts"
        title="Owners"
        description="Every futsal on the platform has one owner account. Owners can't sign up themselves."
        actions={
          <Button variant="admin" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" className="h-[18px] w-[18px]" />
            Add new futsal
          </Button>
        }
      />

      <DataTable
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput value={search} onChange={setSearch} placeholder="Name, email, phone or venue" className="sm:w-80" />
            <div className="flex flex-wrap gap-2">
              <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} count={counts.all}>
                All
              </FilterChip>
              <FilterChip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} count={counts.active}>
                Active
              </FilterChip>
              <FilterChip active={statusFilter === 'inactive'} onClick={() => setStatusFilter('inactive')} count={counts.inactive}>
                Inactive
              </FilterChip>
            </div>
          </div>
        }
        footer={
          !loading && !result.error && rows.length > 0 ? (
            <Pagination {...pager} onPageChange={pager.setPage} />
          ) : null
        }
        columns={columns}
        data={pager.pageItems}
        loading={loading}
        error={result.error}
        onRetry={() => setReload((n) => n + 1)}
        emptyMessage={owners.length ? 'No owners match your filters.' : 'No owners yet. Add the first futsal to get started.'}
        minWidth={860}
      />

      {createOpen && <CreateOwnerModal onClose={closeCreate} onCreated={handleCreated} />}
      {statusTarget && (
        <OwnerStatusModal owner={statusTarget} onClose={() => setStatusTarget(null)} onChanged={handleStatusChanged} />
      )}
      {resetTarget && <ResetPasswordModal owner={resetTarget} onClose={() => setResetTarget(null)} onReset={handleReset} />}
      {credentials && <CredentialsModal data={credentials} onClose={() => setCredentials(null)} />}
    </>
  )
}