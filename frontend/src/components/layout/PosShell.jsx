import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet } from 'react-router-dom'
import { History, LayoutDashboard, LogOut, ShoppingCart, UserRound } from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { shopwiseApi } from '../../services/shopwiseApi'
import { OfflineSyncStatus } from '../../features/offline/OfflineSync'
import { cachedRequest } from '../../features/offline/offlineStore'

const navClass = ({ isActive }) => `flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold sm:px-3 ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`

export function PosShell() {
  const auth = useAuth()
  const userId = auth.user?.id
  useQuery({ queryKey: ['shop'], queryFn: () => cachedRequest(`shop:${userId}`, shopwiseApi.shop.get) })

  return <div className="min-h-screen min-h-[100dvh] bg-[#f5f7f5]">
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-2 backdrop-blur sm:px-6">
      <NavLink to="/pos" className="flex min-h-11 shrink-0 items-center gap-2 px-1 font-extrabold" aria-label="Shopwise POS home">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">S</span>
        <span className="hidden md:inline">Shopwise</span>
      </NavLink>
      <nav className="flex min-w-0 items-center gap-0.5 sm:gap-1" aria-label="POS navigation">
        <OfflineSyncStatus />
        <NavLink to="/pos" end className={navClass}><ShoppingCart size={17} /><span className="hidden sm:inline">POS</span></NavLink>
        <NavLink to="/pos/sales" aria-label="Sales" className={({ isActive }) => `hidden min-h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold min-[440px]:flex sm:px-3 ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}><History size={17} /><span className="hidden md:inline">Sales</span></NavLink>
        {auth.role === 'owner' && <NavLink to="/app" className="flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 sm:px-3" aria-label="Return to owner dashboard" title="Return to owner dashboard"><LayoutDashboard size={18} /><span className="hidden xl:inline">Dashboard</span></NavLink>}
        <NavLink to="/pos/profile" className="hidden size-11 place-items-center rounded-lg text-gray-600 hover:bg-gray-50 min-[380px]:grid" aria-label="Profile"><UserRound size={18} /></NavLink>
        <button onClick={auth.logout} className="grid size-11 place-items-center rounded-lg text-gray-600 hover:bg-gray-50" aria-label="Sign out"><LogOut size={18} /></button>
      </nav>
    </header>
    <Outlet />
  </div>
}
