import { api } from './apiClient'
import { setShopCurrency } from '../utils/format'
const clean = (value) => value || undefined
const syncShop = (request) => request.then((shop) => { setShopCurrency(shop.currency); return shop })

export const shopwiseApi = {
  auth: { signup: (body) => api('/auth/signup', { method: 'POST', body, auth: false }), login: (body) => api('/auth/login', { method: 'POST', body, auth: false }), session: () => api('/auth/session'), logout: () => api('/auth/logout', { method: 'POST' }) },
  profile: { get: () => api('/users/me'), update: (body) => api('/users/me', { method: 'PATCH', body }) },
  shop: { get: () => syncShop(api('/shops/me')), create: (body) => syncShop(api('/shops', { method: 'POST', body })), update: (body) => syncShop(api('/shops/me', { method: 'PATCH', body })) },
  products: {
    list: ({ search, category, status = 'active', page = 1, pageSize = 50 } = {}) => api('/products', { query: { search: clean(search), category: clean(category), status, page, pageSize } }),
    get: (id) => api(`/products/${id}`), create: (body) => api('/products', { method: 'POST', body }), update: (id, body) => api(`/products/${id}`, { method: 'PATCH', body }), archive: (id) => api(`/products/${id}`, { method: 'DELETE' }), restore: (id) => api(`/products/${id}/restore`, { method: 'POST' }),
  },
  inventory: {
    list: ({ search, category, page = 1, pageSize = 50 } = {}) => api('/inventory', { query: { search: clean(search), category: clean(category), page, pageSize } }),
    low: ({ page = 1, pageSize = 50 } = {}) => api('/inventory/low-stock', { query: { page, pageSize } }), get: (id) => api(`/products/${id}/inventory`), movements: (id) => api(`/products/${id}/inventory/movements`), adjust: (id, body) => api(`/products/${id}/inventory/adjustments`, { method: 'POST', body }),
  },
  staff: {
    list: () => api('/shopkeepers'), get: (id) => api(`/shopkeepers/${id}`), create: (body) => api('/shopkeepers', { method: 'POST', body }), update: (id, body) => api(`/shopkeepers/${id}`, { method: 'PATCH', body }), status: (id, isActive) => api(`/shopkeepers/${id}/status`, { method: 'PATCH', body: { isActive } }), reset: (id) => api(`/shopkeepers/${id}/reset-password`, { method: 'POST' }),
  },
  sales: {
    list: ({ page = 1, limit = 50, dateFrom, dateTo, soldBy, status } = {}) => api('/sales', { query: { page, limit, dateFrom: clean(dateFrom), dateTo: clean(dateTo), soldBy: clean(soldBy), status: clean(status) } }),
    get: (id) => api(`/sales/${id}`), checkout: (body) => api('/checkout', { method: 'POST', body }), void: (id, reason) => api(`/sales/${id}/void`, { method: 'POST', body: { reason } }), returnItems: (id, items, reason) => api(`/sales/${id}/returns`, { method: 'POST', body: { items, reason } }),
  },
  payments: { forSale: (id) => api(`/sales/${id}/payments`), get: (id) => api(`/payments/${id}`), intent: (saleId) => api('/payments/stripe/create-intent', { method: 'POST', body: { saleId } }) },
  reports: {
    daily: (date) => api('/reports/daily-sales', { query: { date: clean(date) } }), monthly: (month) => api('/reports/monthly-sales', { query: { month: clean(month) } }), products: (month) => api('/reports/products', { query: { month: clean(month) } }), inventory: (month) => api('/reports/inventory', { query: { month: clean(month) } }), profit: (month) => api('/reports/profit', { query: { month: clean(month) } }), summary: (month) => api('/reports/monthly-summary', { query: { month: clean(month) } }), email: (month) => api('/reports/monthly-summary/email', { method: 'POST', body: month ? { month } : {} }),
  },
}
