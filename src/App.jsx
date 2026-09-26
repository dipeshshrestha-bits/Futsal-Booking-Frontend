import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Button from './components/Button.jsx'
import Footer from './components/Footer.jsx'
import Navbar from './components/Navbar.jsx'
import ProtectedRoute from './components/ProtectedRoutes.jsx'
import SidebarNav from './components/SidebarNav.jsx'
import { ToastProvider } from './components/Toast.jsx'

import BookingConfirmation from './pages/player/BookingConfirmation.jsx'
import BookingLookup from './pages/player/BookingLookup.jsx'
import BookingPage from './pages/player/BookingPage.jsx'
import FutsalDetails from './pages/player/FutsalDetails.jsx'
import Home from './pages/player/Home.jsx'

import ChangePassword from './pages/owner/ChangePassword.jsx'
import OwnerBookings from './pages/owner/OwnerBookings.jsx'
import OwnerCourts from './pages/owner/OwnerCourts.jsx'
import OwnerDashboard from './pages/owner/OwnerDashboard.jsx'
import OwnerLogin from './pages/owner/OwnerLogin.jsx'
import OwnerProfile from './pages/owner/OwnerProfile.jsx'
import OwnerReviews from './pages/owner/OwnerReviews.jsx'

import AdminBookings from './pages/admin/AdminBookings.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminFutsals from './pages/admin/AdminFutsals.jsx'
import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminOwners from './pages/admin/AdminOwners.jsx'
import AdminTransactions from './pages/admin/AdminTransactions.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function PlayerLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

function NotFound() {
  return (
    <div className="player-container py-16 text-center">
      <p className="num text-5xl font-medium">404</p>
      <p className="mt-2 text-muted">This page doesn't exist.</p>
      <Button variant="secondary" className="mt-6" to="/">
        Go home
      </Button>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <ScrollToTop />
      <Routes>
        {/* ---------- Player (public, no login) ---------- */}
        <Route element={<PlayerLayout />}>
          <Route index element={<Home />} />
          <Route path="futsals/:id" element={<FutsalDetails />} />
          <Route path="futsals/:id/book" element={<BookingPage />} />
          <Route path="booking/confirmation/:referenceCode" element={<BookingConfirmation />} />
          <Route path="my-booking" element={<BookingLookup />} />
        </Route>

        {/* ---------- Owner ---------- */}
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route
          path="/owner/change-password"
          element={
            <ProtectedRoute area="owner" allowWhenMustChangePassword>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route path="/owner" element={<ProtectedRoute area="owner" />}>
          <Route element={<SidebarNav theme="owner" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<OwnerDashboard />} />
            <Route path="bookings" element={<OwnerBookings />} />
            <Route path="courts" element={<OwnerCourts />} />
            <Route path="profile" element={<OwnerProfile />} />
            <Route path="reviews" element={<OwnerReviews />} />
          </Route>
        </Route>

        {/* ---------- Admin ---------- */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute area="admin" />}>
          <Route element={<SidebarNav theme="admin" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="owners" element={<AdminOwners />} />
            <Route path="futsals" element={<AdminFutsals />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="transactions" element={<AdminTransactions />} />
          </Route>
        </Route>

        {/* ---------- 404 ---------- */}
        <Route element={<PlayerLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ToastProvider>
  )
}