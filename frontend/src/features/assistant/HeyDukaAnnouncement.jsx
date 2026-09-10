import { useState } from 'react'
import { Bot, Sparkles, X } from 'lucide-react'

const DISMISSED_KEY = 'dukani.hey-duka-announcement.dismissed.v1'

export function HeyDukaAnnouncement() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) !== 'true'
    } catch {
      return true
    }
  })

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      // The announcement can still be dismissed for the current page.
    }
    setOpen(false)
  }

  if (!open) return null

  return <aside className="fixed bottom-4 left-4 right-4 z-40 rounded-xl border border-emerald-100 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.16)] sm:left-auto sm:w-full sm:max-w-sm" aria-label="Hey Duka announcement">
    <div className="flex items-start gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Bot size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-sm font-extrabold text-gray-950">Hey Duka</h2>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">Coming soon</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-600">
              Your AI assistant for quick answers about your shop.
            </p>
          </div>
          <button className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={dismiss} aria-label="Dismiss Hey Duka announcement">
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50/70 px-3 py-2 text-xs leading-5 text-emerald-900/80">
          <Sparkles className="mt-0.5 shrink-0 text-emerald-700" size={14} />
          <p>Ask “Why did I make a loss?” or “What should I restock?”</p>
        </div>
      </div>
    </div>
  </aside>
}
