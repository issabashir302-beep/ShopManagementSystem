import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import { AppError } from '../../errors/AppError.js'
import { ProductService } from './product.service.js'
import { startTestServer } from '../../../tests/helpers/testServer.js'

before(() => { process.env.NODE_ENV = 'test' })
const OWNER_ID = '10000000-0000-4000-8000-000000000001'
const PRODUCT_ID = '50000000-0000-4000-8000-000000000005'
const auth = { userId: OWNER_ID, token: 'token' }
const row = {
  id: PRODUCT_ID, shop_id: 'shop-1', name: 'Coke', sku: 'CC500', barcode: '123', category: 'Drinks',
  unit: 'piece', buying_price: '50.00', selling_price: '70.00', low_stock_threshold: '5.000',
  is_active: true, created_at: 'now', updated_at: 'now', deleted_at: null
}

function fixture({ role = 'owner', product = row, listRows = [row], error } = {}) {
  let created
  let updated
  let archived = false
  const productRepository = {
    async create(shopId, input) { created = { shopId, input }; if (error) throw error; return row },
    async list(shopId, filters) { assert.equal(shopId, 'shop-1'); return { rows: listRows, count: listRows.length, filters } },
    async findById(shopId) { assert.equal(shopId, 'shop-1'); return product },
    async update(shopId, id, changes) { updated = { shopId, id, changes }; return product },
    async archive(shopId, id) { archived = true; return { ...product, is_active: false, deleted_at: 'now' } }
  }
  return {
    service: new ProductService({
      productRepository,
      shopService: { async getCurrentShopContext() {
        return { shop: { id: 'shop-1', owner_id: OWNER_ID }, membership: { role } }
      } },
      logger: { info() {} }
    }),
    created: () => created,
    updated: () => updated,
    archived: () => archived
  }
}

describe('ProductService', () => {
  it('creates product in derived owner shop without stock', async () => {
    const value = fixture()
    const result = await value.service.create(auth, { name: 'Coke', unit: 'piece' }, 'req')
    assert.equal(result.id, PRODUCT_ID)
    assert.equal(value.created().shopId, 'shop-1')
    assert.equal('quantity' in value.created().input, false)
  })

  it('rejects shopkeeper catalog writes', async () => {
    const value = fixture({ role: 'shopkeeper' })
    await assert.rejects(() => value.service.create(auth, { name: 'X' }, 'req'), { code: 'FORBIDDEN' })
    await assert.rejects(() => value.service.update(auth, PRODUCT_ID, { name: 'X' }, 'req'), { code: 'FORBIDDEN' })
    await assert.rejects(() => value.service.archive(auth, PRODUCT_ID, 'req'), { code: 'FORBIDDEN' })
  })

  it('allows owner and shopkeeper to list only derived-shop active products', async () => {
    for (const role of ['owner', 'shopkeeper']) {
      const result = await fixture({ role }).service.list(auth, { status: 'active', page: 1, pageSize: 20 })
      assert.equal(result.items[0].name, 'Coke')
    }
  })

  it('prevents shopkeepers from requesting archived catalog data', async () => {
    await assert.rejects(() => fixture({ role: 'shopkeeper' }).service.list(auth, {
      status: 'all', page: 1, pageSize: 20
    }), { code: 'FORBIDDEN' })
  })

  it('returns safe not-found for a cross-shop/missing product ID', async () => {
    await assert.rejects(() => fixture({ product: null }).service.get(auth, PRODUCT_ID), {
      code: 'PRODUCT_NOT_FOUND'
    })
  })

  it('updates catalog fields and archives without physical deletion', async () => {
    const value = fixture()
    await value.service.update(auth, PRODUCT_ID, { selling_price: '75.00' }, 'req')
    const archived = await value.service.archive(auth, PRODUCT_ID, 'req')
    assert.deepEqual(value.updated().changes, { selling_price: '75.00' })
    assert.equal(value.archived(), true)
    assert.equal(archived.isActive, false)
  })

  it('preserves duplicate SKU/barcode conflict', async () => {
    const error = AppError.conflict('PRODUCT_ALREADY_EXISTS', 'SKU or barcode already exists in this shop')
    await assert.rejects(() => fixture({ error }).service.create(auth, { name: 'X' }, 'req'), {
      code: 'PRODUCT_ALREADY_EXISTS'
    })
  })
})

describe('products API validation', () => {
  let server
  afterEach(async () => { if (server) await server.close(); server = null })

  it('requires authentication', async () => {
    server = await startTestServer()
    assert.equal((await server.request('/api/v1/products')).response.status, 401)
  })

  it('accepts exact catalog fields and normalizes decimals', async () => {
    let received
    server = await startTestServer({ productService: {
      async create(_auth, input) { received = input; return input }, async list() {}, async get() {}, async update() {}, async archive() {}
    } })
    const result = await server.request('/api/v1/products', {
      method: 'POST', token: 'valid-token',
      body: { name: 'Coke', unit: 'piece', buyingPrice: '50.00', sellingPrice: 70, lowStockThreshold: '5.000' }
    })
    assert.equal(result.response.status, 201)
    assert.equal(received.selling_price, '70')
    assert.equal('shop_id' in received, false)
  })

  for (const body of [
    { name: '', unit: 'piece' },
    { name: 'X', unit: 'piece', buyingPrice: -1 },
    { name: 'X', unit: 'piece', sellingPrice: '-1.00' },
    { name: 'X', unit: 'piece', lowStockThreshold: -1 },
    { name: 'X', unit: 'piece', shopId: 'shop-1' },
    { name: 'X', unit: 'piece', quantity: 10 }
  ]) {
    it(`rejects invalid/protected creation ${JSON.stringify(body)}`, async () => {
      server = await startTestServer()
      const result = await server.request('/api/v1/products', { method: 'POST', token: 'valid-token', body })
      assert.equal(result.response.status, 400)
    })
  }

  for (const field of ['shopId', 'shop_id', 'quantity', 'stock', 'id', 'deletedAt', 'isActive']) {
    it(`rejects update field ${field}`, async () => {
      server = await startTestServer()
      const result = await server.request(`/api/v1/products/${PRODUCT_ID}`, {
        method: 'PATCH', token: 'valid-token', body: { [field]: 'bad' }
      })
      assert.equal(result.response.status, 400)
    })
  }

  it('passes validated name/SKU/barcode search and pagination', async () => {
    let filters
    server = await startTestServer({ productService: {
      async create() {}, async get() {}, async update() {}, async archive() {},
      async list(_auth, input) { filters = input; return { items: [] } }
    } })
    const result = await server.request('/api/v1/products?search=CC500&category=Drinks&page=2&pageSize=10', {
      token: 'valid-token'
    })
    assert.equal(result.response.status, 200)
    assert.deepEqual(filters, { search: 'CC500', category: 'Drinks', status: 'active', page: 2, pageSize: 10 })
  })
})
