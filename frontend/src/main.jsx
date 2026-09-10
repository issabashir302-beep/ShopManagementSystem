import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from './app/providers'
import { AppRouter } from './app/router'
import './styles/index.css'
import { applyTheme } from './utils/theme'

applyTheme()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}

createRoot(document.getElementById('root')).render(<StrictMode><AppProviders><AppRouter /></AppProviders></StrictMode>)
