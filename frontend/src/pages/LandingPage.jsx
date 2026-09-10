import { useEffect, useRef } from 'react'
import { ArrowRight, Check, PackageSearch, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { BrandMark } from '../components/branding/BrandMark'
import '../styles/landing.css'

export function LandingPage() {
  const auth = useAuth()
  const preview = useRef(null)
  const workspace = auth.role === 'owner' ? '/app' : '/pos'

  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame
    const move = (event) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const x = event.clientX / innerWidth - .5, y = event.clientY / innerHeight - .5
        preview.current?.style.setProperty('--hero-rx', `${(-y * 3).toFixed(2)}deg`)
        preview.current?.style.setProperty('--hero-ry', `${(x * 4).toFixed(2)}deg`)
        preview.current?.style.setProperty('--hero-y', `${(y * 5).toFixed(1)}px`)
      })
    }
    addEventListener('pointermove', move, { passive: true })
    return () => { cancelAnimationFrame(frame); removeEventListener('pointermove', move) }
  }, [])

  return <div className="landing-hero">
    <HeroBackground />
    <header className="landing-nav">
      <Link to="/" className="landing-brand" aria-label="Dukani home"><BrandMark /><strong>Dukani</strong></Link>
      <nav aria-label="Account navigation">{auth.isAuthenticated ? <Link to={workspace} className="landing-nav-primary">Open workspace <ArrowRight size={15}/></Link> : <><Link to="/login" className="landing-nav-link">Sign in</Link><Link to="/signup" className="landing-nav-primary">Create account <ArrowRight size={15}/></Link></>}</nav>
    </header>
    <main className="landing-stage">
      <HeroContent authenticated={auth.isAuthenticated} workspace={workspace}/>
      <div className="landing-preview-wrap" ref={preview}><LivePOSPreview /></div>
    </main>
    <div className="landing-edge-copy" aria-hidden="true">Built for the rhythm of real retail</div>
  </div>
}

function HeroBackground() {
  return <div className="landing-background" aria-hidden="true">
    <video autoPlay muted loop playsInline preload="metadata" poster="/shopwise/store-hero-poster.png"><source src="/shopwise/store-hero.mp4" type="video/mp4"/></video>
    <div className="landing-treatment"/><div className="landing-grain"/>
  </div>
}

function HeroContent({ authenticated, workspace }) {
  return <section className="landing-copy">
    <p className="landing-eyebrow"><span/>MiniPOS for independent shops</p>
    <h1 aria-label="Run your shop without losing sight of what matters"><span><i>Run your shop</i></span><span><i>without losing sight</i></span><span><i>of what matters.</i></span></h1>
    <p className="landing-intro">Checkout, inventory, staff and payments — one clear workspace for everyday retail.</p>
    <div className="landing-actions">{authenticated ? <Link to={workspace} className="landing-cta">Open your workspace <ArrowRight/></Link> : <><Link to="/signup" className="landing-cta">Create your shop <ArrowRight/></Link><Link to="/login" className="landing-signin">Sign in</Link></>}</div>
    <div className="landing-trust">{['Real inventory','Role-based access','Accurate daily totals'].map(item=><span key={item}><Check size={13}/>{item}</span>)}</div>
  </section>
}

function LivePOSPreview() {
  return <section className="live-pos" aria-label="Dukani live point of sale preview">
    <header className="live-pos-top"><div className="live-pos-mark"><BrandMark /><div><strong>Dukani</strong><small>Corner Market</small></div></div><div className="live-status"><i/>Open · Live</div></header>
    <div className="live-pos-body">
      <div className="live-sales"><div><span>Today’s sales</span><strong>KES 48,420</strong><small>↑ 12.4% vs yesterday</small></div><Sparkline /></div>
      <div className="live-pos-columns">
        <div className="live-receipt"><div className="live-section-title"><span>Recent sale</span><small>Just now</small></div>{[['Organic milk','320'],['Fresh bread','180'],['Coffee beans','690']].map(([name,amount],index)=><div className={`live-sale-row row-${index+1}`} key={name}><span>{name}</span><strong>KES {amount}</strong></div>)}<div className="live-total"><span>Total</span><strong>KES 1,190</strong></div><div className="live-paid"><span><Check size={12}/>Paid via M-Pesa</span><small>#SW-1048</small></div></div>
        <div className="live-stock"><div className="live-section-title"><span>Inventory</span><PackageSearch size={15}/></div><strong>3 products need attention</strong><div><span>Organic milk <b>4 left</b></span><span>Coffee beans <b>7 left</b></span><span>Brown bread <b>9 left</b></span></div><small>Updated live across your shop</small></div>
      </div>
    </div>
    <div className="live-notification"><span><ShoppingBag size={15}/></span><div><strong>Sale completed</strong><small>KES 1,240 · M-Pesa</small></div></div>
  </section>
}

function Sparkline() { return <svg className="live-sparkline" viewBox="0 0 180 72" role="img" aria-label="Sales trending upward"><defs><linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a7359" stopOpacity=".22"/><stop offset="1" stopColor="#1a7359" stopOpacity="0"/></linearGradient></defs><path className="spark-area" d="M2 65 C22 55 27 59 43 46 S69 55 82 39 S104 24 115 34 S136 42 147 20 S167 20 178 5 L178 72 L2 72Z"/><path className="spark-line" d="M2 65 C22 55 27 59 43 46 S69 55 82 39 S104 24 115 34 S136 42 147 20 S167 20 178 5"/><circle cx="178" cy="5" r="4"/></svg> }
