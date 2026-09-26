import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import Navbar from '../../components/Navbar.jsx'
import { Icon } from '../../components/SidebarNav.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useAuth } from '../../Context/AuthContext.jsx'
import { authApi, getErrorMessage } from '../../services/api.js'

function passwordRules(value) {
  return [
    { label: 'At least 8 characters', ok: value.length >= 8 },
    { label: 'Contains a letter', ok: /[A-Za-z]/.test(value) },
    { label: 'Contains a number', ok: /\d/.test(value) },
  ]
}

export default function ChangePassword() {
  const { getSession, login, logout, markPasswordChanged } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const session = getSession('owner')
  const forced = Boolean(session?.mustChangePassword)

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [show, setShow] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const rules = passwordRules(form.newPassword)

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.currentPassword) next.currentPassword = forced ? 'Enter the temporary password you were given.' : 'Enter your current password.'
    if (!form.newPassword) next.newPassword = 'Enter a new password.'
    else if (!rules.every((r) => r.ok)) next.newPassword = 'Your new password does not meet all the requirements.'
    else if (form.newPassword === form.currentPassword) next.newPassword = 'New password must be different from the current one.'
    if (!form.confirmPassword) next.confirmPassword = 'Please confirm your new password.'
    else if (form.confirmPassword !== form.newPassword) next.confirmPassword = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      const response = await authApi.ownerChangePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })

      if (response?.token) {
        login('owner', {
          token: response.token,
          role: response.role ?? 'Owner',
          user: response.user ?? session?.user,
          mustChangePassword: false,
        })
      } else {
        markPasswordChanged('owner')
      }

      toast.success('Password updated')
      navigate('/owner/dashboard', { replace: true })
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not change your password.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    logout('owner')
    navigate('/owner/login', { replace: true })
  }

  const inputType = show ? 'text' : 'password'

  return (
    <div className="owner-shell flex min-h-screen flex-col bg-canvas">
      <Navbar variant="owner" />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {!forced && (
            <Link to="/owner/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
              <Icon name="chevronLeft" className="h-4 w-4" />
              Back to dashboard
            </Link>
          )}

          <p className="eyebrow">Account security</p>
          <h1 className="mt-1 text-[28px] font-semibold">
            {forced ? 'Set your password' : 'Change password'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {forced
              ? 'You signed in with a temporary password. Choose a new one to continue.'
              : 'Choose a strong password you don’t use anywhere else.'}
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-5 rounded-2xl border bg-surface p-5">
            <div>
              <label htmlFor="currentPassword" className="label">
                {forced ? 'Temporary password' : 'Current password'}
              </label>
              <input
                id="currentPassword"
                type={inputType}
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={setField('currentPassword')}
                className={`input ${errors.currentPassword ? 'input-error' : ''}`}
              />
              {errors.currentPassword && <p className="field-error">{errors.currentPassword}</p>}
            </div>

            <div className="mt-3">
              <label htmlFor="newPassword" className="label">New password</label>
              <input
                id="newPassword"
                type={inputType}
                autoComplete="new-password"
                value={form.newPassword}
                onChange={setField('newPassword')}
                className={`input ${errors.newPassword ? 'input-error' : ''}`}
              />
              <ul className="mt-2 space-y-1">
                {rules.map((rule) => (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-2 text-xs ${rule.ok ? 'text-success-text' : 'text-muted'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 items-center justify-center rounded-full ${
                        rule.ok ? 'bg-success-bg' : 'bg-ink/[0.06]'
                      }`}
                    >
                      {rule.ok && <Icon name="check" className="h-3 w-3" />}
                    </span>
                    {rule.label}
                  </li>
                ))}
              </ul>
              {errors.newPassword && <p className="field-error">{errors.newPassword}</p>}
            </div>

            <div className="mt-3">
              <label htmlFor="confirmPassword" className="label">Confirm new password</label>
              <input
                id="confirmPassword"
                type={inputType}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
                className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
              />
              {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-ink" />
              Show passwords
            </label>

            {formError && (
              <div role="alert" className="mt-4 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">
                {formError}
              </div>
            )}

            <Button type="submit" variant="secondary" size="lg" fullWidth className="mt-5" loading={submitting}>
              Update password
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            Wrong account?{' '}
            <button type="button" onClick={handleLogout} className="font-medium text-ink underline underline-offset-2">
              Log out
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}