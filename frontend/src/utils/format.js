const CURRENCY_KEY = 'shopwise.shop.currency'
const currencyLocales = { KES: 'en-KE', TZS: 'sw-TZ', UGX: 'en-UG', RWF: 'rw-RW', USD: 'en-US' }

export const supportedCurrencies = [
  { code: 'KES', label: 'Kenyan shilling (KES)' },
  { code: 'TZS', label: 'Tanzanian shilling (TZS)' },
  { code: 'UGX', label: 'Ugandan shilling (UGX)' },
  { code: 'RWF', label: 'Rwandan franc (RWF)' },
  { code: 'USD', label: 'US dollar (USD)' },
]

export function setShopCurrency(currency) {
  const code = String(currency || '').trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(code)) localStorage.setItem(CURRENCY_KEY, code)
}

export function getShopCurrency() {
  try { return localStorage.getItem(CURRENCY_KEY) || 'KES' } catch { return 'KES' }
}

export const money = (value, currency = getShopCurrency()) => {
  const code = String(currency || 'KES').toUpperCase()
  return new Intl.NumberFormat(currencyLocales[code] || 'en', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(value || 0))
}
export const dateTime = (value) => value ? new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
export const friendly = (value = '') => String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
export const apiMessage = (error) => ({ UNAUTHENTICATED: 'Your session has expired. Sign in again.', FORBIDDEN: 'You do not have permission to do that.', INSUFFICIENT_STOCK: 'There is not enough stock to complete this sale.', PRODUCT_NOT_FOUND: 'This product is no longer available.', BARCODE_ALREADY_EXISTS: 'This barcode is already assigned to another product.', SKU_ALREADY_EXISTS: 'This SKU is already assigned to another product.', RATE_LIMITED: 'Too many attempts. Please wait and try again.', SHOPKEEPER_ACCOUNT_EXISTS: 'A shopkeeper with this email already exists.' }[error?.code] || error?.message || 'Something went wrong. Please try again.')
