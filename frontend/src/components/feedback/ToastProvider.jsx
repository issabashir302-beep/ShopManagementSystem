import { createContext, useContext, useMemo, useState } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'
const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = (id) => setToasts((items) => items.filter((item) => item.id !== id))
  const push = (title, message = '', tone = 'success') => { const id = crypto.randomUUID(); setToasts((items) => [...items, { id, title, message, tone }]); setTimeout(() => dismiss(id), 3500) }
  const value = useMemo(() => ({ success: (title, message) => push(title, message), error: (title, message) => push(title, message, 'error') }), [])
  return <ToastContext.Provider value={value}>{children}<div className="fixed right-4 top-4 z-[80] grid w-[min(360px,calc(100%-2rem))] gap-2" aria-live="polite">{toasts.map((item) => <div key={item.id} className="card flex gap-3 rounded-xl p-4 shadow-lg">{item.tone === 'error' ? <XCircle className="text-red-600" /> : <CheckCircle2 className="text-brand-600" />}<div className="min-w-0 flex-1"><strong className="text-sm">{item.title}</strong>{item.message && <p className="mt-1 text-xs text-gray-500">{item.message}</p>}</div><button onClick={() => dismiss(item.id)} aria-label="Dismiss"><X size={16} /></button></div>)}</div></ToastContext.Provider>
}
export const useToast = () => useContext(ToastContext)
