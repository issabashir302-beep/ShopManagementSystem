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
    <header className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
      <Link to="/" className="flex items-center gap-2.5 text-lg font-extrabold"><span className="grid size-9 place-items-center rounded-lg bg-brand-600 text-white">S</span>Shopwise</Link>
      <nav className="flex items-center gap-2" aria-label="Account navigation">{auth.isAuthenticated?<Link to={workspace} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Open workspace <ArrowRight size={16}/></Link>:<><Link to="/login" className="rounded-lg px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50">Sign in</Link><Link to="/signup" className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Create account</Link></>}</nav>
    </header>
    <main className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:min-h-[650px] lg:grid-cols-[.9fr_1.1fr]">
      <section><p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand-600">MiniPOS for independent shops</p><h1 className="mt-4 max-w-2xl text-5xl font-extrabold leading-[1.02] tracking-[-.045em] sm:text-6xl xl:text-7xl">Run your shop with a clearer view of every sale.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">Shopwise connects checkout, products, inventory, staff, payments, and reports in one calm workspace built for everyday retail.</p>{!auth.isAuthenticated&&<div className="mt-8 flex flex-wrap items-center gap-4"><Link to="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-bold text-white">Create your shop <ArrowRight size={17}/></Link><Link to="/login" className="text-sm font-bold text-brand-700 hover:underline">Sign in to your account</Link></div>}<div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">{['Backend-authoritative totals','Role-based access','Real inventory records'].map(item=><span key={item} className="flex items-center gap-2"><Check size={15} className="text-brand-600"/>{item}</span>)}</div></section>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_30px_90px_rgba(20,92,73,.15)]"><header className="flex h-14 items-center justify-between border-b px-5"><strong className="text-sm">Everything your shop needs</strong><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Connected</span></header><div className="grid gap-3 bg-[#f6f8f6] p-5 sm:grid-cols-2">{features.map(([Icon,title,text])=><article className="flex min-h-32 gap-3 rounded-xl border bg-white p-4" key={title}><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon size={18}/></span><div><h2 className="text-sm font-bold">{title}</h2><p className="mt-2 text-xs leading-5 text-gray-500">{text}</p></div></article>)}</div></section>
    </main>
    <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-t px-5 py-6 text-xs text-gray-500 sm:px-8"><span>Shopwise MiniPOS · Practical software for independent shops.</span><nav className="flex gap-4"><Link to="/about">About</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/contact">Contact</Link></nav></footer>
  </div>
}
