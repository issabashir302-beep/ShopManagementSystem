import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import { InventoryRepository } from './inventory.repository.js'
import { InventoryService } from './inventory.service.js'
import { startTestServer } from '../../../tests/helpers/testServer.js'

before(() => {
  process.env.NODE_ENV = 'test'
})
const OWNER_ID = '10000000-0000-4000-8000-000000000001'
const PRODUCT_ID = '50000000-0000-4000-8000-000000000005'
const auth = { userId: OWNER_ID, token: 'token' }
const product = {
  id: PRODUCT_ID,
  name: 'Flour',
  sku: 'FLR',
  barcode: null,
  category: 'Food',
  unit: 'kg',
  low_stock_threshold: '5.000',
  is_active: true,
  deleted_at: null
}
const balance = { product_id: PRODUCT_ID, quantity: '10.000', updated_at: 'now' }

function fixture({ role = 'owner', foundProduct = product, adjustedBalance = balance } = {}) {
  let adjustment
  const inventoryRepository = {
    async list(shopId) {
      assert.equal(shopId, 'shop-1')
      return { rows: [{ product, balance }], count: 1 }
    },
    async lowStock(shopId) {
      assert.equal(shopId, 'shop-1')
      return {
        rows: [{ ...product, product_id: PRODUCT_ID, quantity: '2.000', updated_at: 'now' }],
        count: 1
      }
    },
    async findProduct(shopId) {
      assert.equal(shopId, 'shop-1')
      return foundProduct
    },
    async findBalance() {
      return balance
    },
    async movements(shopId) {
      assert.equal(shopId, 'shop-1')
      return {
        rows: [
          {
            id: 'm1',
            product_id: PRODUCT_ID,
            movement_type: 'RESTOCK',
            quantity_change: '5.000',
            quantity_before: '5.000',
            quantity_after: '10.000',
            created_at: 'now'
          }
        ],
        count: 1
      }
    },
    async adjust(id, input) {
      adjustment = { id, input }
      return adjustedBalance
    }
  }
  return {
    service: new InventoryService({
      inventoryRepository,
      shopService: {
        async getCurrentShopContext() {
          return { shop: { id: 'shop-1', owner_id: OWNER_ID }, membership: { role } }
        }
      },
      logger: { info() {} }
    }),
    adjustment: () => adjustment
  }
}

const listFilters = { search: null, category: null, page: 1, pageSize: 20 }

describe('InventoryService', () => {
  it('allows owner and shopkeeper to read current shop inventory', async () => {
    for (const role of ['owner', 'shopkeeper']) {
      const result = await fixture({ role }).service.list(auth, listFilters)
      assert.equal(result.items[0].quantity, '10.000')
      assert.equal(result.items[0].isLowStock, false)
    }
  })

  it('uses persisted low-stock results', async () => {
    const result = await fixture().service.lowStock(auth, listFilters)
    assert.equal(result.items[0].quantity, '2.000')
    assert.equal(result.items[0].isLowStock, true)
  })

  it('returns movement history in repository order', async () => {
    const result = await fixture().service.movements(auth, PRODUCT_ID, { page: 1, pageSize: 20 })
    assert.equal(result.items[0].movementType, 'RESTOCK')
    assert.equal(result.items[0].quantityBefore, '5.000')
    assert.equal(result.items[0].quantityAfter, '10.000')
  })

  for (const movementType of ['INITIAL_STOCK', 'RESTOCK', 'ADJUSTMENT', 'DAMAGE']) {
    it(`delegates ${movementType} atomically to repository RPC`, async () => {
      const value = fixture()
      const change = movementType === 'DAMAGE' ? '-1.000' : '5.000'
      await value.service.adjust(
        auth,
        PRODUCT_ID,
        {
          movementType,
          quantityChange: change,
          reason: 'Test adjustment',
          referenceId: null
        },
        'req'
      )
      assert.equal(value.adjustment().id, PRODUCT_ID)
      assert.equal(value.adjustment().input.movementType, movementType)
    })
  }

  it('rejects shopkeeper manual adjustments before RPC', async () => {
    await assert.rejects(
      () =>
        fixture({ role: 'shopkeeper' }).service.adjust(
          auth,
          PRODUCT_ID,
          {
            movementType: 'RESTOCK',
            quantityChange: '1',
            reason: 'Delivery',
            referenceId: null
          },
          'req'
        ),
      { code: 'FORBIDDEN' }
    )
  })

  it('returns safe not-found for cross-shop product adjustment', async () => {
    await assert.rejects(
      () =>
        fixture({ foundProduct: null }).service.adjust(
          auth,
          PRODUCT_ID,
          {
            movementType: 'RESTOCK',
            quantityChange: '1',
            reason: 'Delivery',
            referenceId: null
          },
          'req'
        ),
      { code: 'PRODUCT_NOT_FOUND' }
    )
  })
})

describe('InventoryRepository RPC contract', () => {
  it('calls adjust_inventory once with exact database argument names', async () => {
    let called
    const repository = new InventoryRepository(() => ({
      async rpc(name, args) {
        called = { name, args }
        return { data: balance, error: null }
      }
    }))
    await repository.adjust(
      PRODUCT_ID,
      {
        movementType: 'RESTOCK',
        quantityChange: '25.000',
        reason: 'Supplier delivery',
        referenceId: null
      },
      'token'
    )
    assert.equal(called.name, 'adjust_inventory')
    assert.deepEqual(called.args, {
      p_product_id: PRODUCT_ID,
      p_quantity_change: '25.000',
      p_movement_type: 'RESTOCK',
      p_reason: 'Supplier delivery',
      p_reference_id: null
    })
  })

  it('maps negative-balance and repeated-initial-stock failures safely', async () => {
    for (const [message, code] of [
      ['Insufficient stock: balance cannot become negative', 'INSUFFICIENT_STOCK'],
      ['Initial stock has already been recorded', 'INITIAL_STOCK_ALREADY_SET']
    ]) {
      const repository = new InventoryRepository(() => ({
        async rpc() {
          return { data: null, error: { message } }
        }
      }))
      await assert.rejects(
        () =>
          repository.adjust(
            PRODUCT_ID,
            {
              movementType: 'ADJUSTMENT',
              quantityChange: '-20',
              reason: 'Correction',
              referenceId: null
            },
            'token'
          ),
        { code }
      )
    }
  })
})

describe('inventory API validation and safety', () => {
  let server
  afterEach(async () => {
    if (server) await server.close()
    server = null
  })

  it('requires authentication for inventory reads and writes', async () => {
    server = await startTestServer()
    assert.equal((await server.request('/api/v1/inventory')).response.status, 401)
    assert.equal(
      (
        await server.request(`/api/v1/products/${PRODUCT_ID}/inventory/adjustments`, {
          method: 'POST',
          body: {}
        })
      ).response.status,
      401
    )
  })

  for (const [movementType, quantityChange, expected] of [
    ['INITIAL_STOCK', '10.500', 200],
    ['RESTOCK', 5, 200],
    ['ADJUSTMENT', '-2.250', 200],
    ['DAMAGE', '-1.000', 200],
    ['SALE', '-1', 400],
    ['RETURN', '1', 400],
    ['VOID', '1', 400],
    ['DAMAGE', '1', 400],
    ['RESTOCK', '-1', 400]
  ]) {
    it(`validates ${movementType} ${quantityChange}`, async () => {
      server = await startTestServer()
      const result = await server.request(`/api/v1/products/${PRODUCT_ID}/inventory/adjustments`, {
        method: 'POST',
        token: 'valid-token',
        body: { movementType, quantityChange, reason: 'Valid reason' }
      })
      assert.equal(result.response.status, expected)
    })
  }

  it('rejects arbitrary shop IDs and direct balance mutation fields', async () => {
    server = await startTestServer()
    for (const body of [
      { movementType: 'RESTOCK', quantityChange: '1', reason: 'Delivery', shopId: 'other' },
      { movementType: 'RESTOCK', quantityChange: '1', reason: 'Delivery', quantity: '100' }
    ]) {
      const result = await server.request(`/api/v1/products/${PRODUCT_ID}/inventory/adjustments`, {
        method: 'POST',
        token: 'valid-token',
        body
      })
      assert.equal(result.response.status, 400)
    }
  })

  it('has no direct quantity update endpoint', async () => {
    server = await startTestServer()
    const result = await server.request('/api/v1/inventory', {
      method: 'PATCH',
      token: 'valid-token',
      body: { quantity: 100 }
    })
    assert.equal(result.response.status, 404)
  })
})
