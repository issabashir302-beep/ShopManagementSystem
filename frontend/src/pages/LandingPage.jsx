import { ArrowRight, BarChart3, Boxes, Check, ShoppingCart, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

const features = [
  [ShoppingCart, 'Fast checkout', 'Cash, M-Pesa, and secure card payments.'],
  [Boxes, 'Live inventory', 'Stock balances, movements, and low-stock alerts.'],
  [Users, 'Clear access', 'Dedicated owner and shopkeeper workspaces.'],
  [BarChart3, 'Useful reports', 'Persisted sales, product, inventory, and profit data.'],
]

export function LandingPage() {
  const auth = useAuth()
  const workspace = auth.role === 'owner' ? '/app' : '/pos'
  return <div className="min-h-screen bg-[#f8faf8]">
    <header className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
      <Link to="/" className="flex items-center gap-2.5 text-lg font-extrabold"><span className="grid size-9 place-items-center rounded-lg bg-brand-600 text-white">S</span>Shopwise</Link>
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="Account navigation">{auth.isAuthenticated?<Link to={workspace} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-bold text-white sm:px-4">Open workspace <ArrowRight className="hidden sm:block" size={16}/></Link>:<><Link to="/login" className="rounded-lg px-2.5 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50 sm:px-4">Sign in</Link><Link to="/signup" className="rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-bold text-white sm:px-4"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Create account</span></Link></>}</nav>
    </header>
    <main className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-10 lg:min-h-[650px] lg:grid-cols-[.9fr_1.1fr] lg:gap-12">
      <section><p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand-600">MiniPOS for independent shops</p><h1 className="mt-4 max-w-2xl text-[clamp(2.35rem,10vw,4.5rem)] font-extrabold leading-[1.04] tracking-[-.04em]">Run your shop with a clearer view of every sale.</h1><p className="mt-5 max-w-xl text-base leading-7 text-gray-600 sm:mt-6 sm:text-lg sm:leading-8">Shopwise connects checkout, products, inventory, staff, payments, and reports in one calm workspace built for everyday retail.</p>{!auth.isAuthenticated&&<div className="mt-7 flex flex-wrap items-center gap-4 sm:mt-8"><Link to="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-bold text-white">Create your shop <ArrowRight size={17}/></Link><Link to="/login" className="text-sm font-bold text-brand-700 hover:underline">Sign in to your account</Link></div>}<div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 sm:mt-8">{['Backend-authoritative totals','Role-based access','Real inventory records'].map(item=><span key={item} className="flex items-center gap-2"><Check size={15} className="text-brand-600"/>{item}</span>)}</div></section>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_30px_90px_rgba(20,92,73,.15)]"><header className="flex h-14 items-center justify-between border-b px-5"><strong className="text-sm">Everything your shop needs</strong><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Connected</span></header><div className="grid gap-3 bg-[#f6f8f6] p-5 sm:grid-cols-2">{features.map(([Icon,title,text])=><article className="flex min-h-32 gap-3 rounded-xl border bg-white p-4" key={title}><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon size={18}/></span><div><h2 className="text-sm font-bold">{title}</h2><p className="mt-2 text-xs leading-5 text-gray-500">{text}</p></div></article>)}</div></section>
    </main>
    <footer className="mx-auto flex max-w-7xl flex-col gap-4 border-t px-4 py-6 text-xs text-gray-500 sm:flex-row sm:flex-wrap sm:justify-between sm:px-8"><span>Shopwise MiniPOS · Practical software for independent shops.</span><nav className="flex flex-wrap gap-x-4 gap-y-2"><Link to="/about">About</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/contact">Contact</Link></nav></footer>
  </div>
}
