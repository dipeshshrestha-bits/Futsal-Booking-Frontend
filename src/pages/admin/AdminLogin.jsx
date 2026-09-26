import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import Navbar from '../../components/Navbar.jsx'
import { Icon } from '../../components/SidebarNav.jsx'
import { useAuth } from '../../Context/AuthContext.jsx'
import { authApi, getErrorMessage } from '../../services/api.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AdminLogin() {
  const { getSession, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const expired = searchParams.get('expired') === '1'

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  if (getSession('admin')) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    const next = {}
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.password) next.password = 'Password is required.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSubmitting(true)
    try {
      const data = await authApi.adminLogin({ email: form.email.trim(), password: form.password })
      login('admin', { ...data, role: data?.role ?? 'Admin' })
      const from = location.state?.from?.pathname
      navigate(from && from.startsWith('/admin/') && from !== '/admin/login' ? from : '/admin/dashboard', {
        replace: true,
      })
    } catch (err) {
      const status = err?.response?.status
      if (status === 401) setFormError('Incorrect email or password.')
      else if (status === 403) setFormError('This account does not have admin access.')
      else setFormError(getErrorMessage(err, 'Could not sign in. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-shell flex min-h-screen flex-col bg-canvas">
      <Navbar variant="admin" />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <p className="eyebrow">Platform administration</p>
          <h1 className="mt-1 text-[28px] font-semibold">Admin sign in</h1>
          <p className="mt-1 text-sm text-muted">Manage owners, listings, bookings and payments.</p>

          {expired && (
            <div role="status" className="mt-4 rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning-text">
              Your session expired. Please sign in again.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-5 rounded-2xl border bg-surface p-5">
            <div>
              <label htmlFor="admin-email" className="label">Email</label>
              <input
                id="admin-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={form.email}
                onChange={setField('email')}
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="admin@example.com"
              />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>

            <div className="mt-3">
              <label htmlFor="admin-password" className="label">Password</label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={setField('password')}
                  className={`input pr-16 ${errors.password ? 'input-error' : ''}`}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-ink/[0.06] hover:text-ink"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password}</p>}
            </div>

            {formError && (
              <div role="alert" className="mt-4 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">
                {formError}
              </div>
            )}

            <Button type="submit" variant="admin" size="lg" fullWidth className="mt-5" loading={submitting}>
              <Icon name="lock" className="h-[18px] w-[18px]" />
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">Restricted area. Access attempts may be logged.</p>
        </div>
      </main>
    </div>
  )
}