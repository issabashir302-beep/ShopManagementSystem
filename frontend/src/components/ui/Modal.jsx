import { useEffect } from 'react'
import { X } from 'lucide-react'
export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => { const close = (event) => event.key === 'Escape' && onClose(); if (open) document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [open, onClose])
  if (!open) return null
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4"><h2 id="modal-title" className="text-lg font-bold">{title}</h2><button onClick={onClose} aria-label="Close"><X size={19} /></button></header><div className="p-5">{children}</div>{footer && <footer className="sticky bottom-0 flex justify-end gap-2 border-t bg-white px-5 py-4">{footer}</footer>}</section></div>
}
