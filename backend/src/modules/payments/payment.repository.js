import { AppError } from '../../errors/AppError.js'
const FIELDS = 'id, sale_id, method, status, amount, provider_reference, external_reference, created_at, updated_at'
function paymentError(error) {
  const message = error?.message ?? ''
  if (message.includes('Card payment was not found')) return AppError.notFound('PAYMENT_NOT_FOUND', 'Payment was not found')
  if (message.includes('different Stripe') || message.includes('not eligible')) {
    return AppError.conflict('INVALID_PAYMENT_STATUS', 'Payment is not eligible for card processing')
  }
  if (error?.code === '42501') return AppError.forbidden()
  return new AppError(500, 'PAYMENT_QUERY_FAILED', 'Unable to access payment information')
}
export class PaymentRepository {
  constructor({ forAccessToken, adminClient }) { Object.assign(this, { forAccessToken, adminClient }) }
  async listForSale(shopId, saleId, filters, token) {
    const client = this.forAccessToken(token)
    const sale = await client.from('sales').select('id').eq('shop_id', shopId).eq('id', saleId).maybeSingle()
    if (sale.error) throw paymentError(sale.error)
    if (!sale.data) return null
    const from = (filters.page - 1) * filters.limit
    const result = await client.from('payments').select(FIELDS, { count: 'exact' }).eq('sale_id', saleId)
      .order('created_at', { ascending: false }).range(from, from + filters.limit - 1)
    if (result.error) throw paymentError(result.error)
    return { rows: result.data ?? [], count: result.count ?? 0 }
  }
  async findById(shopId, paymentId, token) {
    const client = this.forAccessToken(token)
    const payment = await client.from('payments').select(FIELDS).eq('id', paymentId).maybeSingle()
    if (payment.error) throw paymentError(payment.error)
    if (!payment.data) return null
    const sale = await client.from('sales').select('id').eq('shop_id', shopId).eq('id', payment.data.sale_id).maybeSingle()
    if (sale.error) throw paymentError(sale.error)
    return sale.data ? payment.data : null
  }

  async findStripeContext(shopId, saleId, token) {
    const client = this.forAccessToken(token)
    const [sale, shop] = await Promise.all([
      client.from('sales').select('id, shop_id, status, payment_status, total_amount').eq('shop_id', shopId).eq('id', saleId).maybeSingle(),
      client.from('shops').select('id, currency').eq('id', shopId).maybeSingle()
    ])
    if (sale.error) throw paymentError(sale.error)
    if (shop.error) throw paymentError(shop.error)
    if (!sale.data || !shop.data) return null
    const payment = await client.from('payments').select(FIELDS).eq('sale_id', saleId).eq('method', 'card').maybeSingle()
    if (payment.error) throw paymentError(payment.error)
    return payment.data ? { sale: sale.data, payment: payment.data, currency: shop.data.currency } : null
  }
  async attachStripeIntent(paymentId, providerReference, token) {
    const { data, error } = await this.forAccessToken(token).rpc('attach_stripe_payment_intent', {
      p_payment_id: paymentId, p_provider_reference: providerReference
    })
    if (error) throw paymentError(error)
    return Array.isArray(data) ? data[0] : data
  }
  async processStripeEvent(event) {
    const { data, error } = await this.adminClient.rpc('process_stripe_payment_event', {
      p_event_id: event.eventId, p_provider_reference: event.providerReference,
      p_payment_status: event.paymentStatus, p_amount_minor: event.amountMinor,
      p_currency: event.currency
    })
    if (error) throw paymentError(error)
    return data
  }
}
