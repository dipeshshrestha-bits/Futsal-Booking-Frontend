import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../Context/AuthContext.jsx'
import { BrandMark } from './Navbar.jsx'

const ICON_PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </>
  ),
  court: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M2.5 9.5H5v5H2.5M21.5 9.5H19v5h2.5" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5V20h16V9.5" />
      <path d="M3 4h18l-1.5 5.5a2.5 2.5 0 01-4.75 0 2.5 2.5 0 01-4.75 0 2.5 2.5 0 01-4.75 0L3 4z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.8a3.5 3.5 0 010 6.4M18.5 14.8c1.6.8 2.6 2.5 3 5.2" />
    </>
  ),
  pitch: (
    <>
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2v-19z" />
      <path d="M9 7.5h6M9 11.5h6M9 15.5h3" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
      <path d="M10 16l-4-4 4-4M6 12h10" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  phone: (
    <path d="M5 3.5h3.5l1.8 4.5-2.3 1.4a11 11 0 005.6 5.6l1.4-2.3 4.5 1.8V18a2.5 2.5 0 01-2.5 2.5C10.2 20.5 3.5 13.8 3.5 6A2.5 2.5 0 015 3.5z" />
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" />
    </>
  ),
  trend: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
}

export function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name] ?? null}
    </svg>
  )
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-semibold sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const NAV_ITEMS = {
  owner: [
    { to: '/owner/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/owner/bookings', label: 'Bookings', icon: 'calendar' },
    { to: '/owner/courts', label: 'Courts', icon: 'court' },
    { to: '/owner/reviews', label: 'Reviews', icon: 'star' },
    { to: '/owner/profile', label: 'Venue profile', icon: 'store' },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/admin/owners', label: 'Owners', icon: 'users' },
    { to: '/admin/futsals', label: 'Futsals', icon: 'pitch' },
    { to: '/admin/bookings', label: 'Bookings', icon: 'calendar' },
    { to: '/admin/transactions', label: 'Transactions', icon: 'receipt' },
  ],
}

const THEMES = {
  owner: {
    title: 'Owner',
    subtitle: 'Venue management',
    shell: 'owner-shell',
    bg: 'bg-owner-shell',
    mark: 'bg-brand',
    login: '/owner/login',
  },
  admin: {
    title: 'Admin',
    subtitle: 'Platform control',
    shell: 'admin-shell',
    bg: 'bg-admin-shell',
    mark: 'bg-admin-accent',
    login: '/admin/login',
  },
}

/**
 * theme: 'owner' | 'admin'
 * badges: { '/owner/bookings': 3 } → small brand-red count badge
 * Renders <Outlet /> when used as a layout route, or children if given.
 */
export default function SidebarNav({ theme = 'owner', items, badges = {}, children }) {
  const meta = THEMES[theme] ?? THEMES.owner
  const navItems = items ?? NAV_ITEMS[theme] ?? NAV_ITEMS.owner
  const { getSession, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const user = getSession(theme)?.user
  const displayName = user?.fullName ?? user?.name ?? user?.email ?? meta.title
  const subline = user?.email && user.email !== displayName ? user.email : `${meta.title} account`
  const initials =
    String(displayName)
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || meta.title[0]

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const handleLogout = () => {
    logout(theme)
    navigate(meta.login, { replace: true })
  }

  return (
    <div className={`${meta.shell} min-h-screen bg-canvas`}>
      {/* Top bar below 1024px */}
      <header className={`sticky top-0 z-30 flex h-14 items-center gap-3 px-4 lg:hidden ${meta.bg}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-1.5 flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10"
        >
          <Icon name="menu" />
        </button>
        <BrandMark className={meta.mark} />
        <p className="text-[15px] font-semibold text-white">
          Futsal <span className="font-normal text-white/50">{meta.title}</span>
        </p>
      </header>

      {/* Drawer backdrop */}
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 animate-fade-in bg-ink/50 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label={`${meta.title} navigation`}
        className={`fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 ease-out lg:translate-x-0 ${meta.bg} ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 px-5">
            <BrandMark className={meta.mark} />
            <div className="min-w-0 leading-tight">
              <p className="text-[15px] font-semibold tracking-tight text-white">
                Futsal <span className="font-normal text-white/50">{meta.title}</span>
              </p>
              <p className="text-[11px] text-white/40">{meta.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <Icon name="close" />
            </button>
          </div>

          <p className="px-5 pt-4 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Menu</p>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
            {navItems.map((item) => {
              const count = Number(badges[item.to])
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors ${
                      isActive
                        ? 'bg-white/10 font-medium text-white'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon name={item.icon} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {count > 0 && (
                    <span className="num inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10.5px] text-white">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>

          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{displayName}</p>
                <p className="truncate text-xs text-white/45">{subline}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon name="logout" className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Page content */}
      <main className="min-w-0 lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  )
}