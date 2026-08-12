import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { GuestRoute, ProtectedRoute } from '../components/layout/RouteGuards'
import { AuthLayout } from '../pages/auth/AuthLayout'
import { LoginPage } from '../pages/auth/LoginPage'
import { SignupPage } from '../pages/auth/SignupPage'
import { LandingPage } from '../pages/LandingPage'
import { InfoPage } from '../pages/InfoPage'
import { OwnerShell } from '../components/layout/OwnerShell'
import { OwnerGate } from '../pages/owner/OwnerGate'
import { DashboardPage } from '../pages/owner/DashboardPage'
import { ProductsPage } from '../pages/owner/ProductsPage'
import { InventoryPage } from '../pages/owner/InventoryPage'
import { ShopkeepersPage } from '../pages/owner/ShopkeepersPage'
import { SalesPage } from '../pages/owner/SalesPage'
import { SaleDetailPage } from '../pages/owner/SaleDetailPage'
import { PaymentsPage } from '../pages/owner/PaymentsPage'
import { ReportsPage } from '../pages/owner/ReportsPage'
import { SettingsPage } from '../pages/owner/SettingsPage'
import { ProfilePage } from '../pages/ProfilePage'
import { PosShell } from '../components/layout/PosShell'
import { PosPage } from '../pages/shopkeeper/PosPage'
import { PosSalesPage } from '../pages/shopkeeper/PosSalesPage'
import { PosSaleDetailPage } from '../pages/shopkeeper/PosSaleDetailPage'
import { NotFoundPage } from '../pages/NotFoundPage'

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/about', element: <InfoPage page="about" /> },
  { path: '/privacy', element: <InfoPage page="privacy" /> },
  { path: '/terms', element: <InfoPage page="terms" /> },
  { path: '/contact', element: <InfoPage page="contact" /> },
  { element: <GuestRoute />, children: [{ element: <AuthLayout />, children: [{ path: '/login', element: <LoginPage /> }, { path: '/signup', element: <SignupPage /> }] }] },
  { element: <ProtectedRoute role="owner" />, children: [{ path: '/app', element: <OwnerShell />, children: [{ element: <OwnerGate />, children: [{ index: true, element: <DashboardPage /> }, { path: 'products', element: <ProductsPage /> }, { path: 'inventory', element: <InventoryPage /> }, { path: 'shopkeepers', element: <ShopkeepersPage /> }, { path: 'sales', element: <SalesPage /> }, { path: 'sales/:saleId', element: <SaleDetailPage /> }, { path: 'payments', element: <PaymentsPage /> }, { path: 'reports', element: <ReportsPage /> }, { path: 'settings', element: <SettingsPage /> }, { path: 'profile', element: <ProfilePage /> }] }] }] },
  { element: <ProtectedRoute />, children: [{ path: '/pos', element: <PosShell />, children: [{ index: true, element: <PosPage /> }, { path: 'sales', element: <PosSalesPage /> }, { path: 'sales/:saleId', element: <PosSaleDetailPage /> }, { path: 'profile', element: <main className="mx-auto max-w-4xl p-4 sm:p-6"><ProfilePage /></main> }] }] },
  { path: '*', element: <NotFoundPage /> },
])

export function AppRouter() { return <RouterProvider router={router} /> }
