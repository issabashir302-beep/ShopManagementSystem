import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import { SaleRepository } from './sale.repository.js'
import { SaleService } from './sale.service.js'
import { startTestServer } from '../../../tests/helpers/testServer.js'

before(() => {
  process.env.NODE_ENV = 'test'
})
const USER_ID = '10000000-0000-4000-8000-000000000001'
const SALE_ID = '70000000-0000-4000-8000-000000000007'
const PRODUCT_ID = '50000000-0000-4000-8000-000000000005'
const REQUEST_ID = '90000000-0000-4000-8000-000000000009'
const auth = { userId: USER_ID, token: 'token' }
const sale = {
  id: SALE_ID,
  sold_by: USER_ID,
  client_request_id: REQUEST_ID,
  receipt_number: 'SW-20260812-000001',
  status: 'completed',
  subtotal: '140.00',
  discount_amount: '0.00',
  tax_amount: '0.00',
  total_amount: '140.00',
  payment_status: 'paid',
  created_at: 'now',
  updated_at: 'now'
}
const item = {
  id: 'item',
  sale_id: SALE_ID,
  product_id: PRODUCT_ID,
  product_name: 'Coke',
  unit: 'piece',
  quantity: '2.000',
  unit_price: '70.00',
  unit_cost: '50.00',
  discount_amount: '0.00',
  tax_amount: '0.00',
  subtotal: '140.00',
  created_at: 'now'
}
const payment = {
  id: 'payment',
  sale_id: SALE_ID,
  method: 'cash',
  status: 'completed',
  amount: '140.00',
  created_at: 'now',
  updated_at: 'now'
}

function fixture({
  role = 'owner',
  checkoutResult = { sale_id: SALE_ID, idempotent_replay: false },
  detail = { sale, items: [item], payments: [payment] }
} = {}) {
  let call
  const service = new SaleService({
    saleRepository: {
      async checkout(shopId, input) {
        call = { shopId, input }
        return checkoutResult
      },
      async findById() {
        return detail
      },
      async list() {
        return { rows: [sale], count: 1 }
      }
    },
    shopService: {
      async getCurrentShopContext() {
        return { shop: { id: 'shop-1' }, membership: { role } }
      }
    },
    logger: { info() {} }
  })
  return { service, call: () => call }
}

describe('Sales checkout service', () => {
  for (const role of ['owner', 'shopkeeper'])
    it(`${role} checks out in the derived shop`, async () => {
      const value = fixture({ role })
      const result = await value.service.checkout(
        auth,
        {
          clientRequestId: REQUEST_ID,
          payment: { method: 'cash' },
          items: [{ product_id: PRODUCT_ID, quantity: '2.000' }]
        },
        'req'
      )
      assert.equal(value.call().shopId, 'shop-1')
      assert.equal(result.sale.totalAmount, '140.00')
      assert.equal(result.payment.amount, '140.00')
    })
  it('returns the same persisted sale for an idempotent replay', async () => {
    const result = await fixture({
      checkoutResult: { sale_id: SALE_ID, idempotent_replay: true }
    }).service.checkout(auth, { payment: { method: 'cash' }, items: [] }, 'req')
    assert.equal(result.sale.id, SALE_ID)
    assert.equal(result.idempotentReplay, true)
  })
  it('returns safe not-found for cross-shop sale detail', async () => {
    await assert.rejects(() => fixture({ detail: null }).service.get(auth, SALE_ID), {
      code: 'SALE_NOT_FOUND'
    })
  })
})

describe('Sales RPC contract and error mapping', () => {
  it('calls only the atomic checkout RPC with derived financial inputs', async () => {
    let called
    const repository = new SaleRepository(() => ({
      async rpc(name, args) {
        called = { name, args }
        return { data: { sale_id: SALE_ID }, error: null }
      }
    }))
    await repository.checkout(
      'shop-1',
      {
        clientRequestId: REQUEST_ID,
        payment: { method: 'cash', providerReference: null, externalReference: null },
        items: [{ product_id: PRODUCT_ID, quantity: '2.000' }]
      },
      'token'
    )
    assert.equal(called.name, 'create_sale_with_items')
    assert.equal(called.args.sale_data.shop_id, 'shop-1')
    assert.equal('total_amount' in called.args.sale_data, false)
    assert.equal('unit_price' in called.args.items[0], false)
  })
  for (const [message, code] of [
    ['Insufficient stock for product Coke', 'INSUFFICIENT_STOCK'],
    ['Product x is unavailable for this shop', 'PRODUCT_NOT_FOUND']
  ]) {
    it(`maps database failure to ${code}`, async () => {
      const repository = new SaleRepository(() => ({
        async rpc() {
          return { error: { message } }
        }
      }))
      await assert.rejects(() => repository.checkout('shop', { payment: {}, items: [] }, 'token'), {
        code
      })
    })
  }
})

describe('Checkout API validation and financial authority', () => {
  let server
  afterEach(async () => {
    if (server) await server.close()
    server = null
  })
  const valid = {
    clientRequestId: REQUEST_ID,
    payment: { method: 'cash' },
    items: [{ productId: PRODUCT_ID, quantity: '2.000' }]
  }
  it('requires authentication', async () => {
    server = await startTestServer()
    assert.equal(
      (await server.request('/api/v1/checkout', { method: 'POST', body: valid })).response.status,
      401
    )
  })
  it('passes only product, quantity, method and idempotency data', async () => {
    let received
    server = await startTestServer({
      saleService: {
        async checkout(_a, input) {
          received = input
          return {}
        },
        async list() {},
        async get() {}
      }
    })
    assert.equal(
      (
        await server.request('/api/v1/checkout', {
          method: 'POST',
          token: 'valid-token',
          body: valid
        })
      ).response.status,
      201
    )
    assert.deepEqual(received.items, [{ product_id: PRODUCT_ID, quantity: '2.000' }])
  })
  for (const body of [
    { ...valid, items: [] },
    { ...valid, items: [{ productId: PRODUCT_ID, quantity: 0 }] },
    { ...valid, items: [{ productId: PRODUCT_ID, quantity: '-1' }] },
    { ...valid, items: [{ productId: 'bad', quantity: '1' }] },
    { ...valid, payment: { method: 'bank' } },
    { ...valid, totalAmount: '1.00' },
    { ...valid, soldBy: USER_ID },
    { ...valid, items: [{ productId: PRODUCT_ID, quantity: '1', unitPrice: '1' }] },
    { ...valid, payment: { method: 'cash', status: 'completed', amount: '1' } }
  ])
    it(`rejects malformed/protected checkout ${JSON.stringify(body)}`, async () => {
      server = await startTestServer()
      assert.equal(
        (await server.request('/api/v1/checkout', { method: 'POST', token: 'valid-token', body }))
          .response.status,
        400
      )
    })
  it('rejects duplicate products', async () => {
    server = await startTestServer()
    const body = { ...valid, items: [valid.items[0], valid.items[0]] }
    assert.equal(
      (await server.request('/api/v1/checkout', { method: 'POST', token: 'valid-token', body }))
        .body.error.code,
      'DUPLICATE_PRODUCT'
    )
  })
  it('accepts card but rejects browser-supplied Stripe references', async () => {
    let received
    server = await startTestServer({
      saleService: {
        async checkout(_auth, input) {
          received = input
          return {}
        },
        async list() {},
        async get() {}
      }
    })
    const card = { ...valid, payment: { method: 'card' } }
    assert.equal(
      (
        await server.request('/api/v1/checkout', {
          method: 'POST',
          token: 'valid-token',
          body: card
        })
      ).response.status,
      201
    )
    assert.equal(received.payment.method, 'card')
    const injected = { ...card, payment: { method: 'card', providerReference: 'pi_attacker' } }
    assert.equal(
      (
        await server.request('/api/v1/checkout', {
          method: 'POST',
          token: 'valid-token',
          body: injected
        })
      ).response.status,
      400
    )
  })
  it('preserves cash and M-Pesa checkout methods', async () => {
    const methods = []
    server = await startTestServer({
      saleService: {
        async checkout(_auth, input) {
          methods.push(input.payment.method)
          return {}
        },
        async list() {},
        async get() {}
      }
    })
    for (const method of ['cash', 'mpesa']) {
      const result = await server.request('/api/v1/checkout', {
        method: 'POST',
        token: 'valid-token',
        body: { ...valid, payment: { method } }
      })
      assert.equal(result.response.status, 201)
    }
    assert.deepEqual(methods, ['cash', 'mpesa'])
  })
})
