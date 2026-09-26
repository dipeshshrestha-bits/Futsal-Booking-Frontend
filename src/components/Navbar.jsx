import { Link, NavLink } from 'react-router-dom'
import StatusPill from './StatusPill.jsx'

export function BrandMark({ className = 'bg-brand' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5l3.2 2.3-1.2 3.8h-4l-1.2-3.8L12 7.5z" fill="currentColor" stroke="none" />
        <path d="M12 7.5V3.2M15.2 9.8l4-1.4M14 13.6l2.5 3.6M10 13.6l-2.5 3.6M8.8 9.8l-4-1.4" />
      </svg>
    </span>
  )
}

const playerLink = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-ink/[0.06] text-ink' : 'text-muted hover:text-ink'
  }`

/** variant: 'player' (default) | 'owner' | 'admin' (used on login pages) */
export default function Navbar({ variant = 'player' }) {
  if (variant === 'owner' || variant === 'admin') {
    const isAdmin = variant === 'admin'
    return (
      <header className="border-b bg-canvas">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark className={isAdmin ? 'bg-admin-shell' : 'bg-owner-shell'} />
            <span className="text-[15px] font-semibold tracking-tight">Futsal</span>
            <StatusPill variant={isAdmin ? 'info' : 'neutral'} dot={false}>
              {isAdmin ? 'Admin' : 'Owner'}
            </StatusPill>
          </Link>
          <Link to="/" className="text-sm text-muted transition-colors hover:text-ink">
            ← Back to site
          </Link>
        </div>
      </header>
    )
  }

  return (
    <header className="glass sticky top-0 z-30 border-b">
      <div className="player-container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-tight">Futsal</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={playerLink}>
            Venues
          </NavLink>
          <NavLink to="/my-booking" className={playerLink}>
            My booking
          </NavLink>
        </nav>
      </div>
    </header>
  )
}