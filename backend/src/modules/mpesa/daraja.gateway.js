import { AppError } from '../../errors/AppError.js'

const BASE_URLS = { sandbox: 'https://sandbox.safaricom.co.ke', production: 'https://api.safaricom.co.ke' }
const timestamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

async function jsonRequest(url, options) {
  let response
  try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) }) }
  catch { throw new AppError(503, 'MPESA_UNAVAILABLE', 'M-Pesa is temporarily unavailable') }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new AppError(502, 'MPESA_REQUEST_FAILED', body.errorMessage || body.error_description || 'M-Pesa rejected the request')
  return body
}

export class DarajaGateway {
  base(environment) { return BASE_URLS[environment] }
  async accessToken(config) {
    const authorization = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')
    const body = await jsonRequest(`${this.base(config.environment)}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${authorization}` } })
    if (!body.access_token) throw new AppError(502, 'MPESA_AUTH_FAILED', 'M-Pesa did not return an access token')
    return body.access_token
  }
  async verify(config) { await this.accessToken(config); return true }
  async stkPush(config, { amount, phoneNumber, accountReference, callbackUrl }) {
    const token = await this.accessToken(config), time = timestamp()
    return jsonRequest(`${this.base(config.environment)}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ BusinessShortCode: config.shortcode, Password: Buffer.from(`${config.shortcode}${config.passkey}${time}`).toString('base64'), Timestamp: time, TransactionType: config.shortcodeType === 'till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline', Amount: Math.round(Number(amount)), PartyA: phoneNumber, PartyB: config.storeNumber || config.shortcode, PhoneNumber: phoneNumber, CallBackURL: callbackUrl, AccountReference: accountReference.slice(0, 12), TransactionDesc: 'Dukani sale' })
    })
  }
}
