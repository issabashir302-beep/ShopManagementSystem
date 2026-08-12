import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'
import { ReturnRepository } from './return.repository.js'
import { ReturnService } from './return.service.js'
import { startTestServer } from '../../../tests/helpers/testServer.js'

const SALE_ID = '70000000-0000-4000-8000-000000000007'
const ITEM_ID = '71000000-0000-4000-8000-000000000007'

describe('ReturnService authorization', () => {
  const ownerContext = {
    shop: { id: 'shop-1', owner_id: 'owner-1' },
    membership: { role: 'owner' }
  }

  it('allows an owner to void and return through one RPC call', async () => {
    const calls = []
    const service = new ReturnService({
      shopService: {
        async getCurrentShopContext() {
          return ownerContext
        }
      },
      returnRepository: {
        async voidSale(...args) {
          calls.push(['void', ...args])
          return { return_id: 'r1' }
        },
        async createReturn(...args) {
          calls.push(['return', ...args])
          return { return_id: 'r2' }
        }
      },
      logger: { info() {} }
    })
    await service.voidSale(
      { userId: 'owner-1', token: 'token' },
      SALE_ID,
      { reason: 'Error' },
      'req'
    )
    await service.createReturn(
      { userId: 'owner-1', token: 'token' },
      SALE_ID,
      { reason: 'Returned', items: [{ sale_item_id: ITEM_ID, quantity: '1.000' }] },
      'req'
    )
    assert.equal(calls.length, 2)
    assert.equal(calls[0][0], 'void')
    assert.equal(calls[1][0], 'return')
  })

  it('rejects shopkeepers before calling a financial RPC', async () => {
    let called = false
    const service = new ReturnService({
      shopService: {
        async getCurrentShopContext() {
          return { shop: { id: 'shop-1', owner_id: 'owner-1' }, membership: { role: 'shopkeeper' } }
        }
      },
      returnRepository: {
        async voidSale() {
          called = true
        }
      },
      logger: { info() {} }
    })
    await assert.rejects(
      service.voidSale({ userId: 'keeper-1' }, SALE_ID, { reason: 'No' }, 'req'),
      (error) => error.code === 'FORBIDDEN'
    )
    assert.equal(called, false)
  })
})

describe('ReturnRepository RPC contract', () => {
  it('uses only transactional return and void RPCs', async () => {
    const calls = []
    const repository = new ReturnRepository(() => ({
      async rpc(name, args) {
        calls.push({ name, args })
        return { data: {}, error: null }
      }
    }))
    await repository.voidSale(SALE_ID, 'Mistake', 'token')
    await repository.createReturn(
      SALE_ID,
      { reason: 'Customer return', items: [{ sale_item_id: ITEM_ID, quantity: '1.000' }] },
      'token'
    )
    assert.deepEqual(
      calls.map((call) => call.name),
      ['void_sale', 'create_sale_return']
    )
  })
})

describe('returns API validation', () => {
  let server
  const calls = []
  before(async () => {
    server = await startTestServer({
      returnService: {
        async voidSale(_auth, id, input) {
          calls.push({ type: 'void', id, input })
          return {}
        },
        async createReturn(_auth, id, input) {
          calls.push({ type: 'return', id, input })
          return {}
        }
      }
    })
  })
  after(() => server.close())

  it('requires authentication', async () => {
    const { response } = await server.request(`/api/v1/sales/${SALE_ID}/void`, {
      method: 'POST',
      body: { reason: 'Mistake' }
    })
    assert.equal(response.status, 401)
  })

  it('accepts a valid void and partial return', async () => {
    const voidResult = await server.request(`/api/v1/sales/${SALE_ID}/void`, {
      method: 'POST',
      token: 'valid-token',
      body: { reason: 'Mistaken sale' }
    })
    const returnResult = await server.request(`/api/v1/sales/${SALE_ID}/returns`, {
      method: 'POST',
      token: 'valid-token',
      body: { reason: 'Customer return', items: [{ saleItemId: ITEM_ID, quantity: '1.000' }] }
    })
    assert.equal(voidResult.response.status, 201)
    assert.equal(returnResult.response.status, 201)
    assert.equal(calls.at(-1).input.items[0].sale_item_id, ITEM_ID)
  })

  it('rejects zero, excessive precision, duplicate items, and protected fields', async () => {
    const bodies = [
      { reason: 'x', items: [{ saleItemId: ITEM_ID, quantity: 0 }] },
      { reason: 'x', items: [{ saleItemId: ITEM_ID, quantity: '1.0001' }] },
      {
        reason: 'x',
        items: [
          { saleItemId: ITEM_ID, quantity: 1 },
          { saleItemId: ITEM_ID, quantity: 1 }
        ]
      },
      { reason: 'x', refundAmount: '1.00', items: [{ saleItemId: ITEM_ID, quantity: 1 }] }
    ]
    for (const body of bodies) {
      const { response } = await server.request(`/api/v1/sales/${SALE_ID}/returns`, {
        method: 'POST',
        token: 'valid-token',
        body
      })
      assert.equal(response.status, 400)
    }
  })
})

describe('returns SQL safety contract', () => {
  it('preserves originals and performs stock, movement, refund, and audit work in RPCs', async () => {
    const sql = await readFile(
      new URL('../../../../supabase/database.sql', import.meta.url),
      'utf8'
    )
    for (const fragment of [
      'create table public.sale_returns',
      'create table public.sale_return_items',
      'create or replace function public.void_sale',
      'create or replace function public.create_sale_return',
      'movement_type, quantity_change',
      "'VOID'",
      "'RETURN'",
      "'SALE_VOIDED'",
      "'SALE_RETURNED'"
    ])
      assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    assert.doesNotMatch(sql, /delete\s+from\s+public\.(sales|sale_items|payments)/i)
  })

  it('keeps fresh-install and upgrade definitions for the return model', async () => {
    const migration = await readFile(
      new URL(
        '../../../../supabase/migrations/20260812_add_sale_returns_and_voids.sql',
        import.meta.url
      ),
      'utf8'
    )
    for (const fragment of [
      'create table public.sale_returns',
      'create table public.sale_return_items',
      'create or replace function public.void_sale',
      'create or replace function public.create_sale_return',
      'sale_returns_one_void_per_sale_uq',
      'sale_returns_select_owner',
      'sale_return_items_select_owner'
    ]) {
      assert.match(migration, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    }
  })
})
