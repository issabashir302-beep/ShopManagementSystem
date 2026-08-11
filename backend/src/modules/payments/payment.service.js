import { AppError } from '../../errors/AppError.js'
import { publicPayment } from '../sales/sale.service.js'
import { toStripeAmount } from './money.js'
export class PaymentService {
  constructor({ paymentRepository, shopService, stripeGateway, logger }) {
    Object.assign(this, { paymentRepository, shopService, stripeGateway, logger })
  }
  async listForSale(auth, saleId, filters) {
    const context = await this.shopService.getCurrentShopContext(auth)
    const result = await this.paymentRepository.listForSale(context.shop.id, saleId, filters, auth.token)
    if (!result) throw AppError.notFound('SALE_NOT_FOUND', 'Sale was not found')
    return { items: result.rows.map(publicPayment), pagination: { page: filters.page, pageSize: filters.limit,
      total: result.count, totalPages: Math.ceil(result.count / filters.limit) } }
  }
  async get(auth, paymentId) {
    const context = await this.shopService.getCurrentShopContext(auth)
    const payment = await this.paymentRepository.findById(context.shop.id, paymentId, auth.token)
    if (!payment) throw AppError.notFound('PAYMENT_NOT_FOUND', 'Payment was not found')
    return publicPayment(payment)
  }
  async createStripeIntent(auth, input, requestId) {
    const context = await this.shopService.getCurrentShopContext(auth)
    const value = await this.paymentRepository.findStripeContext(context.shop.id, input.saleId, auth.token)
    if (!value) throw AppError.notFound('SALE_NOT_FOUND', 'Eligible card sale was not found')
    if (value.sale.status !== 'completed') throw AppError.conflict('INVALID_SALE_STATUS', 'Sale is not eligible for payment')
    if (value.sale.payment_status === 'paid' || value.payment.status === 'completed') {
      throw AppError.conflict('SALE_ALREADY_PAID', 'Sale has already been paid')
    }
    if (!['pending', 'failed'].includes(value.payment.status)) {
      throw AppError.conflict('INVALID_PAYMENT_STATUS', 'Payment is not eligible for card processing')
    }
    if (value.payment.status === 'failed' && !value.payment.provider_reference) {
      throw AppError.conflict('INVALID_PAYMENT_STATUS', 'Failed card payment has no reusable Stripe intent')
    }

    const amount = toStripeAmount(value.sale.total_amount, value.currency)
    if (toStripeAmount(value.payment.amount, value.currency) !== amount) {
      throw new AppError(500, 'PAYMENT_AMOUNT_MISMATCH', 'Stored payment amount does not match the sale')
    }
    let intent
    if (value.payment.provider_reference) {
      intent = await this.stripeGateway.retrievePaymentIntent(value.payment.provider_reference)
    } else {
      intent = await this.stripeGateway.createPaymentIntent({
        amount, currency: value.currency.toLowerCase(), automatic_payment_methods: { enabled: true },
        metadata: { sale_id: value.sale.id, payment_id: value.payment.id, shop_id: context.shop.id }
      }, `shopwise-payment-${value.payment.id}`)
      await this.paymentRepository.attachStripeIntent(value.payment.id, intent.id, auth.token)
    }
    if (intent.amount !== amount || intent.currency.toLowerCase() !== value.currency.toLowerCase()) {
      throw new AppError(500, 'STRIPE_INTENT_MISMATCH', 'Stored Stripe intent does not match the sale')
    }
    this.logger.info('stripe_intent_ready', { requestId, shopId: context.shop.id, saleId: value.sale.id,
      paymentId: value.payment.id, stripePaymentIntentId: intent.id })
    return { paymentId: value.payment.id, saleId: value.sale.id, clientSecret: intent.client_secret,
      status: value.payment.status }
  }
  async handleStripeWebhook(rawBody, signature, requestId) {
    if (!signature) throw AppError.badRequest('INVALID_STRIPE_SIGNATURE', 'Stripe-Signature header is required')
    const event = this.stripeGateway.constructEvent(rawBody, signature)
    const statuses = { 'payment_intent.succeeded': 'completed', 'payment_intent.payment_failed': 'failed' }
    const paymentStatus = statuses[event.type]
    if (!paymentStatus) return { received: true, ignored: true }
    const intent = event.data.object
    const result = await this.paymentRepository.processStripeEvent({ eventId: event.id,
      providerReference: intent.id, paymentStatus, amountMinor: intent.amount,
      currency: intent.currency })
    this.logger.info(paymentStatus === 'completed' ? 'payment_completed' : 'payment_failed', {
      requestId, stripeEventId: event.id, stripePaymentIntentId: intent.id,
      duplicate: result?.duplicate === true
    })
    return { received: true, duplicate: result?.duplicate === true, ignored: result?.ignored === true }
  }
}
