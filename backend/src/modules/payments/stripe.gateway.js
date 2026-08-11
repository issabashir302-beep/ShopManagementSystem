import Stripe from 'stripe'
import { AppError } from '../../errors/AppError.js'

export class StripeGateway {
  constructor({ secretKey, webhookSecret }) {
    this.client = new Stripe(secretKey)
    this.webhookSecret = webhookSecret
  }

  async createPaymentIntent(input, idempotencyKey) {
    try {
      return await this.client.paymentIntents.create(input, { idempotencyKey })
    } catch {
      throw new AppError(502, 'STRIPE_UNAVAILABLE', 'Unable to initialize card payment')
    }
  }

  async retrievePaymentIntent(id) {
    try { return await this.client.paymentIntents.retrieve(id) } catch {
      throw new AppError(502, 'STRIPE_UNAVAILABLE', 'Unable to retrieve card payment')
    }
  }

  constructEvent(rawBody, signature) {
    try {
      return this.client.webhooks.constructEvent(rawBody, signature, this.webhookSecret)
    } catch {
      throw AppError.badRequest('INVALID_STRIPE_SIGNATURE', 'Stripe webhook signature is invalid')
    }
  }
}
