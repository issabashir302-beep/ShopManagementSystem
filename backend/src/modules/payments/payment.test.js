import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import { AppError } from '../../errors/AppError.js'
import { PaymentService } from './payment.service.js'
import { toStripeAmount } from './money.js'
import { startTestServer } from '../../../tests/helpers/testServer.js'

before(() => { process.env.NODE_ENV = 'test' })
const SALE_ID = '70000000-0000-4000-8000-000000000007'
const PAYMENT_ID = '80000000-0000-4000-8000-000000000008'
const payment = { id: PAYMENT_ID, sale_id: SALE_ID, method: 'card', status: 'pending', amount: '500.00', provider_reference: null, created_at: 'now', updated_at: 'now' }
const sale = { id: SALE_ID, shop_id: 'shop-1', status: 'completed', payment_status: 'pending', total_amount: '500.00' }
const intent = { id: 'pi_test', amount: 50000, currency: 'kes', client_secret: 'pi_test_secret' }

function fixture({ context = { sale, payment, currency: 'KES' }, stripeIntent = intent, stripeError,
  event, eventResult = { duplicate: false } } = {}) {
  let created, attached, processed, retrieved = 0
  const service = new PaymentService({
    paymentRepository: {
      async findStripeContext(shopId) { assert.equal(shopId, 'shop-1'); return context },
      async attachStripeIntent(id, reference) { attached = { id, reference }; return payment },
      async processStripeEvent(input) { processed = input; return eventResult },
      async listForSale() { return { rows: [payment], count: 1 } }, async findById() { return payment }
    },
    shopService: { async getCurrentShopContext() { return { shop: { id: 'shop-1' } } } },
    stripeGateway: {
      async createPaymentIntent(input, key) { if (stripeError) throw stripeError; created = { input, key }; return stripeIntent },
      async retrievePaymentIntent() { retrieved += 1; return stripeIntent },
      constructEvent() { if (stripeError) throw stripeError; return event }
    }, logger: { info() {} }
  })
  return { service, created: () => created, attached: () => attached, processed: () => processed, retrieved: () => retrieved }
}

describe('Stripe card PaymentIntent creation', () => {
  it('uses the authoritative database amount and stable Stripe idempotency key', async () => {
    const value = fixture()
    const result = await value.service.createStripeIntent({ token: 't' }, { saleId: SALE_ID }, 'req')
    assert.equal(value.created().input.amount, 50000)
    assert.equal(value.created().input.currency, 'kes')
    assert.equal(value.created().key, `shopwise-payment-${PAYMENT_ID}`)
    assert.equal(value.created().input.metadata.payment_id, PAYMENT_ID)
    assert.deepEqual(value.attached(), { id: PAYMENT_ID, reference: 'pi_test' })
    assert.equal(result.clientSecret, 'pi_test_secret'); assert.equal(result.status, 'pending')
  })
  it('reuses an attached PaymentIntent instead of creating another', async () => {
    const value = fixture({ context: { sale, payment: { ...payment, provider_reference: 'pi_test' }, currency: 'KES' } })
    await value.service.createStripeIntent({ token: 't' }, { saleId: SALE_ID }, 'req')
    assert.equal(value.created(), undefined); assert.equal(value.retrieved(), 1)
  })
  it('returns safe not-found for invalid or cross-shop sale', async () => {
    await assert.rejects(() => fixture({ context: null }).service.createStripeIntent({ token: 't' }, { saleId: SALE_ID }, 'req'), { code: 'SALE_NOT_FOUND' })
  })
  it('rejects an already-paid sale', async () => {
    const paid = { sale: { ...sale, payment_status: 'paid' }, payment: { ...payment, status: 'completed' }, currency: 'KES' }
    await assert.rejects(() => fixture({ context: paid }).service.createStripeIntent({ token: 't' }, { saleId: SALE_ID }, 'req'), { code: 'SALE_ALREADY_PAID' })
  })
  it('maps Stripe API failures without leaking provider details', async () => {
    const error = new AppError(502, 'STRIPE_UNAVAILABLE', 'Unable to initialize card payment')
    await assert.rejects(() => fixture({ stripeError: error }).service.createStripeIntent({ token: 't' }, { saleId: SALE_ID }, 'req'), { code: 'STRIPE_UNAVAILABLE' })
  })
  it('rejects inconsistent persisted payment amount', async () => {
    const context = { sale, payment: { ...payment, amount: '1.00' }, currency: 'KES' }
    await assert.rejects(() => fixture({ context }).service.createStripeIntent({ token: 't' }, { saleId: SALE_ID }, 'req'), { code: 'PAYMENT_AMOUNT_MISMATCH' })
  })
  it('converts currency amounts without floating-point arithmetic', () => {
    assert.equal(toStripeAmount('500.05', 'KES'), 50005)
    assert.equal(toStripeAmount('500', 'JPY'), 500)
    assert.equal(toStripeAmount('1.25', 'KWD'), 1250)
  })
})

describe('Stripe webhook handling', () => {
  const succeeded = { id: 'evt_1', type: 'payment_intent.succeeded', data: { object: intent } }
  it('processes a signature-verified success through the trusted RPC', async () => {
    const value = fixture({ event: succeeded })
    const result = await value.service.handleStripeWebhook(Buffer.from('{}'), 'signature', 'req')
    assert.deepEqual(value.processed(), { eventId: 'evt_1', providerReference: 'pi_test', paymentStatus: 'completed', amountMinor: 50000, currency: 'kes' })
    assert.equal(result.received, true); assert.equal(result.duplicate, false)
  })
  it('processes payment failure without accepting browser status', async () => {
    const value = fixture({ event: { ...succeeded, id: 'evt_2', type: 'payment_intent.payment_failed' } })
    await value.service.handleStripeWebhook(Buffer.from('{}'), 'signature', 'req')
    assert.equal(value.processed().paymentStatus, 'failed')
  })
  it('reports duplicate webhook delivery safely', async () => {
    const result = await fixture({ event: succeeded, eventResult: { duplicate: true } }).service.handleStripeWebhook(Buffer.from('{}'), 'signature', 'req')
    assert.equal(result.duplicate, true)
  })
  it('rejects missing or invalid webhook signatures', async () => {
    await assert.rejects(() => fixture({ event: succeeded }).service.handleStripeWebhook(Buffer.from('{}'), null, 'req'), { code: 'INVALID_STRIPE_SIGNATURE' })
    const invalid = AppError.badRequest('INVALID_STRIPE_SIGNATURE', 'Stripe webhook signature is invalid')
    await assert.rejects(() => fixture({ stripeError: invalid }).service.handleStripeWebhook(Buffer.from('{}'), 'bad', 'req'), { code: 'INVALID_STRIPE_SIGNATURE' })
  })
})

describe('Payments API security', () => {
  let server; afterEach(async () => { if (server) await server.close(); server = null })
  it('requires authentication for PaymentIntent creation', async () => {
    server = await startTestServer()
    assert.equal((await server.request('/api/v1/payments/stripe/create-intent', { method: 'POST', body: { saleId: SALE_ID } })).response.status, 401)
  })
  it('accepts only saleId and never amount or status', async () => {
    server = await startTestServer()
    for (const body of [{ saleId: SALE_ID, amount: 1 }, { saleId: SALE_ID, status: 'completed' }]) {
      assert.equal((await server.request('/api/v1/payments/stripe/create-intent', { method: 'POST', token: 'valid-token', body })).response.status, 400)
    }
  })
  it('creates an intent for an authenticated request', async () => {
    let received
    server = await startTestServer({ paymentService: { async listForSale() {}, async get() {}, async handleStripeWebhook() {},
      async createStripeIntent(_auth, input) { received = input; return { clientSecret: 'secret', status: 'pending' } } } })
    const result = await server.request('/api/v1/payments/stripe/create-intent', { method: 'POST', token: 'valid-token', body: { saleId: SALE_ID } })
    assert.equal(result.response.status, 201); assert.deepEqual(received, { saleId: SALE_ID }); assert.equal(result.body.data.status, 'pending')
  })
  it('allows an unauthenticated webhook only through its signature workflow', async () => {
    let received
    server = await startTestServer({ paymentService: { async listForSale() {}, async get() {}, async createStripeIntent() {},
      async handleStripeWebhook(body, signature) { received = { isBuffer: Buffer.isBuffer(body), signature }; return { received: true } } } })
    const result = await server.request('/api/v1/payments/stripe/webhook', { method: 'POST', body: { id: 'evt' }, headers: { 'stripe-signature': 'sig' } })
    assert.equal(result.response.status, 200); assert.deepEqual(received, { isBuffer: true, signature: 'sig' })
  })
  it('keeps arbitrary payment status mutation unavailable', async () => {
    server = await startTestServer()
    assert.equal((await server.request(`/api/v1/payments/${PAYMENT_ID}`, { method: 'PATCH', token: 'valid-token', body: { status: 'completed' } })).response.status, 404)
  })
})
