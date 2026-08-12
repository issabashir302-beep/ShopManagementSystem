import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'

export const workspaceForRole = (role) => (role === 'owner' ? '/app' : '/pos')

export function GuestRoute() {
  const auth = useAuth()
  if (auth.isLoading) return null
  if (!auth.isAuthenticated) return <Outlet />
  return <Navigate to={workspaceForRole(auth.role)} replace />
}

export function ProtectedRoute({ role }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-gray-500">Opening Shopwise...</div>
  }
  if (!auth.isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (role && auth.role !== role) return <Navigate to={workspaceForRole(auth.role)} replace />
  return <Outlet />
}
