import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

const DOTS = {
  success: 'bg-success-text',
  error: 'bg-danger-text',
  warning: 'bg-warning-text',
  info: 'bg-info-text',
}

let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    ({ type = 'info', title, message, duration = 4000 } = {}) => {
      nextId += 1
      const id = nextId
      setToasts((list) => [...list.slice(-3), { id, type, title, message }])
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration))
      }
      return id
    },
    [dismiss]
  )

  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((timer) => clearTimeout(timer))
      map.clear()
    }
  }, [])

  const value = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, opts) => show({ ...opts, type: 'success', message }),
      error: (message, opts) => show({ duration: 6000, ...opts, type: 'error', message }),
      warning: (message, opts) => show({ ...opts, type: 'warning', message }),
      info: (message, opts) => show({ ...opts, type: 'info', message }),
    }),
    [show, dismiss]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:top-auto sm:right-5 sm:bottom-5 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-float"
          >
            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOTS[t.type] ?? DOTS.info}`} />
            <div className="min-w-0 flex-1">
              {t.title && <p className="text-sm font-semibold">{t.title}</p>}
              {t.message && (
                <p className={`text-sm ${t.title ? 'text-muted' : 'text-ink'}`}>{t.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// The hook must access the context created by this provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

export default ToastProvider
