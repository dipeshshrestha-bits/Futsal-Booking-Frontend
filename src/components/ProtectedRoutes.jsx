import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../Context/AuthContext.jsx'

/**
 * area: 'owner' | 'admin'
 * - No valid token for THAT area → redirect to that area's login.
 *   (An Owner token never unlocks /admin/* and vice versa.)
 * - Owner with mustChangePassword → forced to /owner/change-password.
 */
export default function ProtectedRoute({ area, allowWhenMustChangePassword = false, children }) {
  const { getSession } = useAuth()
  const location = useLocation()

  if (area !== 'owner' && area !== 'admin') {
    return <Navigate to="/" replace />
  }

  const session = getSession(area)

  if (!session) {
    return <Navigate to={`/${area}/login`} replace state={{ from: location }} />
  }

  if (
    area === 'owner' &&
    session.mustChangePassword &&
    !allowWhenMustChangePassword &&
    location.pathname !== '/owner/change-password'
  ) {
    return <Navigate to="/owner/change-password" replace />
  }

  return children ?? <Outlet />
}