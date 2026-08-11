import { AppError } from '../../errors/AppError.js'

const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'])
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND'])

export function toStripeAmount(decimal, currency) {
  const normalizedCurrency = String(currency).toUpperCase()
  const scale = ZERO_DECIMAL.has(normalizedCurrency) ? 0 : THREE_DECIMAL.has(normalizedCurrency) ? 3 : 2
  const match = String(decimal).match(/^(\d+)(?:\.(\d+))?$/)
  if (!match) throw new AppError(500, 'INVALID_PAYMENT_AMOUNT', 'Stored payment amount is invalid')
  const fraction = match[2] ?? ''
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) {
    throw new AppError(500, 'UNSUPPORTED_CURRENCY_PRECISION', 'Stored amount cannot be represented in the payment currency')
  }
  const minor = BigInt(match[1]) * (10n ** BigInt(scale)) + BigInt((fraction.slice(0, scale) || '').padEnd(scale, '0') || '0')
  if (minor <= 0n || minor > 99_999_999n) throw AppError.unprocessable('INVALID_PAYMENT_AMOUNT', 'Payment amount is outside Stripe limits')
  return Number(minor)
}
