const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '')
const SESSION_KEY = 'shopwise.react.session'
let refreshRequest = null

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', details = null, requestId = null } = {}) {
    super(message)
    this.name = 'ApiError'
    Object.assign(this, { status, code, details, requestId })
  }
}

export const sessionStore = {
  read() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { this.clear(); return null } },
  write(value) { value ? localStorage.setItem(SESSION_KEY, JSON.stringify(value)) : localStorage.removeItem(SESSION_KEY) },
  clear() { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem('shopwise.checkout') },
}

async function parseResponse(response) {
  const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null
  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.error?.message || `Request failed with HTTP ${response.status}`, {
      status: response.status, code: payload?.error?.code, details: payload?.error?.details,
      requestId: payload?.requestId || response.headers.get('x-request-id'),
    })
  }
  return { data: payload?.data ?? payload, requestId: payload?.requestId }
}

async function refreshSession() {
  if (refreshRequest) return refreshRequest
  const current = sessionStore.read()
  if (!current?.refreshToken) throw new ApiError('Session expired', { status: 401, code: 'UNAUTHENTICATED' })
  refreshRequest = fetch(`${API_URL}/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: current.refreshToken }),
  }).then(parseResponse).then(({ data }) => {
    const next = { ...current, ...data.session, user: data.user || current.user }
    sessionStore.write(next)
    return next
  }).finally(() => { refreshRequest = null })
  return refreshRequest
}

export async function apiRequest(path, { method = 'GET', body, query, auth = true, retryAuth = true, timeoutMs = 20000 } = {}) {
  const url = new URL(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`)
  Object.entries(query || {}).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value) })
  const session = sessionStore.read()
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await parseResponse(await fetch(url, { method, headers, signal: controller.signal, body: body === undefined ? undefined : JSON.stringify(body) }))
  } catch (error) {
    if (auth && retryAuth && error.status === 401 && session?.refreshToken) {
      try { await refreshSession(); return apiRequest(path, { method, body, query, auth, retryAuth: false, timeoutMs }) }
      catch (refreshError) {
        // Losing connectivity during refresh is not the same as losing authorization.
        // Keep the cached identity/tokens so the POS can enter its controlled offline mode.
        if (refreshError.status === 401 || refreshError.status === 403 || refreshError.code === 'UNAUTHENTICATED') {
          sessionStore.clear()
          window.dispatchEvent(new Event('shopwise:session-expired'))
        }
        throw refreshError
      }
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const api = (path, options) => apiRequest(path, options).then(({ data }) => data)
export async function dependenciesReady(timeoutMs = 2000) {
  if (!navigator.onLine) return false
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_URL}/readiness`, { signal: controller.signal, headers: { Accept: 'application/json' } })
    return response.ok
  } catch { return false }
  finally { clearTimeout(timeout) }
}
export { refreshSession }
