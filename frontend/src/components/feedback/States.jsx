import { useEffect, useState } from 'react'
import { AlertCircle, Box } from 'lucide-react'
import { Button } from '../ui/Button'
export function PageLoading({ label = 'Loading…', progress }) {
  const [estimated, setEstimated] = useState(8)
  useEffect(() => {
    if (progress !== undefined) return undefined
    const timer = setInterval(() => setEstimated((value) => Math.min(92, value + Math.max(1, Math.ceil((92 - value) / 12)))), 220)
    return () => clearInterval(timer)
  }, [progress])
  const value = Math.max(0, Math.min(100, Math.round(progress ?? estimated)))
  return <div className="grid min-h-64 place-items-center px-6 py-12 text-center" role="status" aria-live="polite" aria-label={`${label} ${value}%`}><div><div className="shopwise-loader mx-auto" style={{ '--loader-progress': `${value}%` }} aria-hidden="true"><div className="shopwise-loader-fill"><div className="shopwise-loader-motion" /></div><strong>{value}%</strong></div><p className="mt-4 text-sm font-medium text-gray-500">{label}</p></div></div>
}
export function EmptyState({ title, message, action }) { return <div className="grid place-items-center px-6 py-16 text-center"><Box className="mb-3 text-gray-400" /><h3 className="font-bold">{title}</h3><p className="mt-1 max-w-md text-sm text-gray-500">{message}</p>{action && <div className="mt-4">{action}</div>}</div> }
export function ErrorState({ error, retry }) { return <div className="card grid place-items-center rounded-xl px-6 py-14 text-center"><AlertCircle className="mb-3 text-red-600" /><h3 className="font-bold">Unable to load this page</h3><p className="mt-1 text-sm text-gray-500">{error?.message || 'Try again shortly.'}</p>{retry && <Button className="mt-4" variant="secondary" onClick={retry}>Try again</Button>}</div> }
