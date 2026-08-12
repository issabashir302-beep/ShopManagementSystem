import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../features/auth/AuthContext'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { queryClient } from '../services/queryClient'
export function AppProviders({ children }) { return <QueryClientProvider client={queryClient}><AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider></QueryClientProvider> }
