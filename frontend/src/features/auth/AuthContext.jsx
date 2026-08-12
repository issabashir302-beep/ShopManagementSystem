import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { shopwiseApi } from '../../services/shopwiseApi'
import { sessionStore } from '../../services/apiClient'

const AuthContext = createContext(null)

function persistAuth(payload) {
  if (!payload?.session) return false
  sessionStore.write({ accessToken: payload.session.accessToken, refreshToken: payload.session.refreshToken, expiresAt: payload.session.expiresAt, tokenType: payload.session.tokenType, user: payload.user })
  return true
}

export function AuthProvider({ children }) {
  const [identity, setIdentity] = useState(null)
  const [isLoading, setLoading] = useState(Boolean(sessionStore.read()?.accessToken))

  const hydrate = useCallback(async () => {
    if (!sessionStore.read()?.accessToken) { setIdentity(null); setLoading(false); return null }
    try {
      const [session, profile] = await Promise.all([shopwiseApi.auth.session(), shopwiseApi.profile.get()])
      const next = { user: session.user, profile, role: profile.userRole }
      setIdentity(next)
      return next
    } catch (error) { if (error.status === 401) sessionStore.clear(); setIdentity(null); throw error }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { hydrate().catch(() => {}) }, [hydrate])
  useEffect(() => { const expired = () => { setIdentity(null); setLoading(false) }; window.addEventListener('shopwise:session-expired', expired); return () => window.removeEventListener('shopwise:session-expired', expired) }, [])

  const login = async (email, password) => { const payload = await shopwiseApi.auth.login({ email, password }); persistAuth(payload); return hydrate() }
  const signup = async (body) => { const payload = await shopwiseApi.auth.signup(body); if (persistAuth(payload)) return hydrate(); return payload }
  const logout = async () => { try { if (sessionStore.read()?.accessToken) await shopwiseApi.auth.logout() } finally { sessionStore.clear(); setIdentity(null) } }
  const value = useMemo(() => ({ ...identity, isAuthenticated: Boolean(identity), isLoading, login, signup, logout, refreshSession: hydrate }), [identity, isLoading, hydrate])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context }
