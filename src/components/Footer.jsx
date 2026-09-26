import { Link } from 'react-router-dom'
import { BrandMark } from './Navbar.jsx'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-12 border-t">
      <div className="player-container py-8 lg:py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <BrandMark className="bg-ink" />
              <p className="text-[15px] font-semibold tracking-tight">Futsal</p>
            </div>
            <p className="mt-3 text-sm text-muted">
              Find a court, pick a slot, and play. Pay cash at the venue or online with eSewa.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
            <Link to="/" className="text-muted transition-colors hover:text-ink">
              Browse venues
            </Link>
            <Link to="/my-booking" className="text-muted transition-colors hover:text-ink">
              Find my booking
            </Link>
            <Link to="/owner/login" className="text-muted transition-colors hover:text-ink">
              Venue owner login
            </Link>
          </nav>
        </div>

        <div className="mt-8 flex items-center justify-between border-t pt-4 text-xs text-faint">
          <span>
            © <span className="num">{year}</span> Futsal Booking
          </span>
          <span>Nepal</span>
        </div>
      </div>
    </footer>
  )
}