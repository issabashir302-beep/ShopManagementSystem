import { useEffect } from 'react'
import { X } from 'lucide-react'
export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => { const close = (event) => event.key === 'Escape' && onClose(); if (open) document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [open, onClose])
  if (!open) return null
  return <div className="fixed inset-0 z-50 grid items-end bg-black/40 sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-xl" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="flex shrink-0 items-center justify-between border-b bg-white px-4 py-3 sm:px-5 sm:py-4"><h2 id="modal-title" className="min-w-0 break-words pr-3 text-lg font-bold">{title}</h2><button className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-gray-100" onClick={onClose} aria-label="Close"><X size={19} /></button></header><div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>{footer && <footer className="safe-bottom flex shrink-0 flex-wrap justify-end gap-2 border-t bg-white px-4 py-3 sm:px-5 sm:py-4 [&>*]:max-sm:flex-1">{footer}</footer>}</section></div>
}
