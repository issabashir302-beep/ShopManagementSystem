import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Boxes, ChartNoAxesCombined, CreditCard, Grid2X2, LogOut, Menu, PackageSearch, ReceiptText, Settings, UserRound, UsersRound, X } from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
const links = [['/app', 'Overview', Grid2X2, true], ['/app/products', 'Products', PackageSearch], ['/app/inventory', 'Inventory', Boxes], ['/app/sales', 'Sales', ReceiptText], ['/app/shopkeepers', 'Shopkeepers', UsersRound], ['/app/payments', 'Payments', CreditCard], ['/app/reports', 'Reports', ChartNoAxesCombined], ['/app/settings', 'Settings', Settings], ['/app/profile', 'Profile', UserRound]]

export function OwnerShell() {
  const [open, setOpen] = useState(false); const auth = useAuth()
  return <div className="min-h-screen min-h-[100dvh] bg-[#f6f7f5] lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
    {open && <button className="fixed inset-0 z-30 bg-black/35 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[min(18rem,86vw)] flex-col border-r bg-white transition-transform lg:static lg:w-56 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-16 items-center justify-between border-b px-5"><NavLink to="/app" className="flex items-center gap-2 font-extrabold"><span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">S</span>Shopwise</NavLink><button className="lg:hidden" onClick={() => setOpen(false)}><X size={19} /></button></div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">{links.map(([to, label, Icon, end]) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Icon size={18} />{label}</NavLink>)}</nav>
      <div className="border-t p-3"><div className="mb-2 px-3"><strong className="block truncate text-sm">{auth.profile?.fullName}</strong><span className="block truncate text-xs text-gray-500">{auth.profile?.email}</span></div><button onClick={auth.logout} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"><LogOut size={18} />Sign out</button></div>
    </aside>
    <div className="min-w-0"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur lg:px-7"><button className="grid size-11 place-items-center rounded-lg lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button><span className="hidden text-sm text-gray-500 sm:block">Owner workspace</span><NavLink to="/pos" className="inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">Open POS</NavLink></header><main className="mx-auto w-full max-w-[1440px] p-3 min-[380px]:p-4 sm:p-6 lg:p-8"><Outlet /></main></div>
  </div>
}
