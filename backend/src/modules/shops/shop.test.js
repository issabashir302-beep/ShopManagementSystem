import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import { ShopService } from './shop.service.js'
import { startTestServer } from '../../../tests/helpers/testServer.js'

before(() => { process.env.NODE_ENV = 'test' })

const auth = { userId: 'owner-1', token: 'token' }
const shopRow = {
  id: 'shop-1', owner_id: 'owner-1', name: 'Mini Mart', currency: 'KES',
  type: null, location: null, address: null, city: null, country: null,
  created_at: '2026-01-01', updated_at: '2026-01-01'
}

function makeService({ role = 'owner', owned = [], memberships = [], shop = shopRow } = {}) {
  let created
  let updated
  return {
    service: new ShopService({
      userRepository: { async findById() { return { id: auth.userId, user_role: role } } },
      shopRepository: {
        async findOwnedShops() { return owned },
        async findMemberships() { return memberships },
        async findShopById() { return shop },
        async create(input) { created = input; return { ...shopRow, ...input } },
        async update(_id, input) { updated = input; return { ...shopRow, ...input } }
      }
    }),
    created: () => created,
    updated: () => updated
  }
}

describe('ShopService', () => {
  it('creates one owner shop and derives owner_id from authentication', async () => {
    const fixture = makeService()
    const result = await fixture.service.createShop(auth, { name: 'Mini Mart', currency: 'KES' })
    assert.equal(result.ownerId, 'owner-1')
    assert.equal(fixture.created().owner_id, 'owner-1')
  })

  it('rejects shopkeeper creation', async () => {
    const { service } = makeService({ role: 'shopkeeper' })
    await assert.rejects(() => service.createShop(auth, { name: 'X' }), { code: 'FORBIDDEN' })
  })

  it('rejects a second owner shop', async () => {
    const { service } = makeService({ owned: [shopRow] })
    await assert.rejects(() => service.createShop(auth, { name: 'X' }), { code: 'SHOP_ALREADY_EXISTS' })
  })

  it('returns an owner or shopkeeper assigned shop through membership', async () => {
    for (const role of ['owner', 'shopkeeper']) {
      const { service } = makeService({ role, memberships: [{ shop_id: 'shop-1', role }] })
      const result = await service.getCurrentShop(auth)
      assert.equal(result.id, 'shop-1')
    }
  })

  it('handles no shop and multiple shops explicitly', async () => {
    const none = makeService()
    const multiple = makeService({ memberships: [
      { shop_id: 'one', role: 'owner' }, { shop_id: 'two', role: 'owner' }
    ] })
    await assert.rejects(() => none.service.getCurrentShop(auth), { code: 'SHOP_NOT_FOUND' })
    await assert.rejects(() => multiple.service.getCurrentShop(auth), { code: 'MULTIPLE_SHOPS_NOT_SUPPORTED' })
  })

  it('allows owner update and rejects shopkeeper update', async () => {
    const owner = makeService({ memberships: [{ shop_id: 'shop-1', role: 'owner' }] })
    const keeper = makeService({ role: 'shopkeeper', memberships: [{ shop_id: 'shop-1', role: 'shopkeeper' }] })
    const result = await owner.service.updateCurrentShop(auth, { city: 'Nairobi' })
    assert.equal(result.city, 'Nairobi')
    await assert.rejects(() => keeper.service.updateCurrentShop(auth, { city: 'Nairobi' }), { code: 'FORBIDDEN' })
  })
})

describe('shops API validation and authentication', () => {
  let server
  afterEach(async () => { if (server) await server.close(); server = null })

  it('requires authentication', async () => {
    server = await startTestServer()
    assert.equal((await server.request('/api/v1/shops/me')).response.status, 401)
    assert.equal((await server.request('/api/v1/shops', { method: 'POST', body: { name: 'X' } })).response.status, 401)
  })

  for (const field of ['ownerId', 'owner_id', 'id', 'deletedAt', 'deleted_at', 'createdAt']) {
    it(`rejects protected shop field ${field}`, async () => {
      server = await startTestServer()
      const result = await server.request('/api/v1/shops', {
        method: 'POST', token: 'valid-token', body: { name: 'Mini Mart', [field]: 'malicious' }
      })
      assert.equal(result.response.status, 400)
      assert.equal(result.body.error.code, 'VALIDATION_ERROR')
    })
  }

  it('accepts safe shop updates and rejects protected updates', async () => {
    server = await startTestServer()
    const valid = await server.request('/api/v1/shops/me', {
      method: 'PATCH', token: 'valid-token', body: { name: 'New Shop', currency: 'kes' }
    })
    const invalid = await server.request('/api/v1/shops/me', {
      method: 'PATCH', token: 'valid-token', body: { owner_id: 'other' }
    })
    assert.equal(valid.response.status, 200)
    assert.equal(valid.body.data.currency, 'KES')
    assert.equal(invalid.response.status, 400)
  })
})
