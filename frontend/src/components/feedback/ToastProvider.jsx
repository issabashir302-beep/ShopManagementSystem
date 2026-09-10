import { createContext, useContext, useMemo, useState } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'
const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = (id) => setToasts((items) => items.filter((item) => item.id !== id))
  const push = (title, message = '', tone = 'success') => { const id = crypto.randomUUID(); setToasts((items) => [...items.slice(-2), { id, title, message, tone }]); setTimeout(() => dismiss(id), 3500) }
  const value = useMemo(() => ({ success: (title, message) => push(title, message), error: (title, message) => push(title, message, 'error') }), [])
  return <ToastContext.Provider value={value}>{children}<div className="pointer-events-none fixed right-4 top-4 z-[80] h-28 w-[min(360px,calc(100%-2rem))]" aria-live="polite">{toasts.map((item,index) => { const depth=toasts.length-1-index; return <div key={item.id} className={`card absolute inset-x-0 top-0 flex gap-3 rounded-xl p-4 shadow-lg transition-all ${depth?'pointer-events-none':'pointer-events-auto'}`} style={{transform:`translateY(${Math.min(depth,2)*8}px) scale(${1-Math.min(depth,2)*.025})`,zIndex:toasts.length-depth,opacity:depth===2?.72:1}}>{item.tone === 'error' ? <XCircle className="shrink-0 text-red-600" /> : <CheckCircle2 className="shrink-0 text-brand-600" />}<div className="min-w-0 flex-1"><strong className="text-sm">{item.title}</strong>{item.message && <p className="mt-1 text-xs text-gray-500">{item.message}</p>}</div><button onClick={() => dismiss(item.id)} aria-label="Dismiss"><X size={16} /></button></div>})}</div></ToastContext.Provider>
}
export const useToast = () => useContext(ToastContext)
