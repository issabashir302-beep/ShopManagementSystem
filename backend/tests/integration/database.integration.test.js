import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const url = process.env.TEST_SUPABASE_URL
const anonKey = process.env.TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
const disposable = process.env.TEST_SUPABASE_DISPOSABLE === 'true'
const enabled = Boolean(url && anonKey && serviceKey && disposable)

const suite = enabled ? describe : describe.skip

suite('disposable Supabase financial integration', () => {
  const runId = randomUUID().slice(0, 8)
  const password = `Test-${randomUUID()}-aA1!`
  let admin
  let ownerA
  let ownerB
  let ownerAId
  let ownerBId
  let shopAId
  let shopBId

  async function createOwner(label) {
    const email = `shopwise-${runId}-${label}@example.test`
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { user_role: 'owner' },
      user_metadata: { full_name: `${label} Owner` }
    })
    assert.ifError(created.error)
    const client = createClient(url, anonKey, { auth: { persistSession: false } })
    const login = await client.auth.signInWithPassword({ email, password })
    assert.ifError(login.error)
    return { id: created.data.user.id, client }
  }

  async function createProduct(client, shopId, name, stock) {
    const product = await client
      .from('products')
      .insert({
        shop_id: shopId,
        name: `${name}-${runId}`,
        unit: 'piece',
        buying_price: '4.00',
        selling_price: '10.00',
        low_stock_threshold: 1
      })
      .select('id')
      .single()
    assert.ifError(product.error)
    if (stock > 0) {
      const adjusted = await client.rpc('adjust_inventory', {
        p_product_id: product.data.id,
        p_quantity_change: stock,
        p_movement_type: 'INITIAL_STOCK',
        p_reason: 'Integration test seed',
        p_reference_id: null
      })
      assert.ifError(adjusted.error)
    }
    return product.data.id
  }

  async function checkout(client, shopId, productIds, requestId = randomUUID(), method = 'cash') {
    return client.rpc('create_sale_with_items', {
      sale_data: {
        shop_id: shopId,
        client_request_id: requestId,
        payment_method: method,
        payment_metadata: {}
      },
      items: productIds.map(({ id, quantity }) => ({ product_id: id, quantity }))
    })
  }

  before(async () => {
    admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const a = await createOwner('a')
    const b = await createOwner('b')
    ;({ id: ownerAId, client: ownerA } = a)
    ;({ id: ownerBId, client: ownerB } = b)
    const shopA = await ownerA
      .from('shops')
      .insert({ owner_id: ownerAId, name: `A-${runId}`, type: 'retail' })
      .select('id')
      .single()
    const shopB = await ownerB
      .from('shops')
      .insert({ owner_id: ownerBId, name: `B-${runId}`, type: 'retail' })
      .select('id')
      .single()
    assert.ifError(shopA.error)
    assert.ifError(shopB.error)
    shopAId = shopA.data.id
    shopBId = shopB.data.id
  })

  after(async () => {
    await ownerA?.auth.signOut()
    await ownerB?.auth.signOut()
    // Immutable ledgers intentionally prevent cleanup. Reset the disposable project after the run.
  })

  it('serializes two checkouts for the final unit', async () => {
    const productId = await createProduct(ownerA, shopAId, 'concurrency', 1)
    const results = await Promise.all([
      checkout(ownerA, shopAId, [{ id: productId, quantity: '1.000' }]),
      checkout(ownerA, shopAId, [{ id: productId, quantity: '1.000' }])
    ])
    assert.equal(results.filter((result) => !result.error).length, 1)
    assert.equal(
      results.filter((result) => result.error?.message.includes('Insufficient stock')).length,
      1
    )
    const inventory = await admin
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId)
      .single()
    const sales = await admin.from('sales').select('id', { count: 'exact' }).eq('shop_id', shopAId)
    const saleId = results.find((result) => result.data)?.data.sale_id
    const payments = await admin
      .from('payments')
      .select('id', { count: 'exact' })
      .eq('sale_id', saleId)
    const movements = await admin
      .from('inventory_movements')
      .select('id', { count: 'exact' })
      .eq('reference_id', saleId)
      .eq('movement_type', 'SALE')
    assert.equal(inventory.data.quantity, 0)
    assert.equal(sales.count, 1)
    assert.equal(payments.count, 1)
    assert.equal(movements.count, 1)
  })

  it('rolls back every checkout write when the second item fails', async () => {
    const validId = await createProduct(ownerA, shopAId, 'rollback-valid', 2)
    const emptyId = await createProduct(ownerA, shopAId, 'rollback-empty', 0)
    const requestId = randomUUID()
    const result = await checkout(
      ownerA,
      shopAId,
      [
        { id: validId, quantity: '1.000' },
        { id: emptyId, quantity: '1.000' }
      ],
      requestId
    )
    assert.match(result.error?.message ?? '', /Insufficient stock/)
    const sale = await admin.from('sales').select('id').eq('client_request_id', requestId)
    const inventory = await admin
      .from('inventory')
      .select('quantity')
      .eq('product_id', validId)
      .single()
    const movements = await admin
      .from('inventory_movements')
      .select('id')
      .eq('product_id', validId)
      .eq('movement_type', 'SALE')
    assert.deepEqual(sale.data, [])
    assert.equal(inventory.data.quantity, 2)
    assert.deepEqual(movements.data, [])
  })

  it('persists one transaction for an idempotent retry', async () => {
    const productId = await createProduct(ownerA, shopAId, 'idempotency', 3)
    const requestId = randomUUID()
    const first = await checkout(ownerA, shopAId, [{ id: productId, quantity: '1.000' }], requestId)
    const second = await checkout(
      ownerA,
      shopAId,
      [{ id: productId, quantity: '1.000' }],
      requestId
    )
    assert.ifError(first.error)
    assert.ifError(second.error)
    assert.equal(first.data.sale_id, second.data.sale_id)
    assert.equal(second.data.idempotent_replay, true)
    const payments = await admin
      .from('payments')
      .select('id', { count: 'exact' })
      .eq('sale_id', first.data.sale_id)
    const items = await admin
      .from('sale_items')
      .select('id', { count: 'exact' })
      .eq('sale_id', first.data.sale_id)
    const inventory = await admin
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId)
      .single()
    assert.equal(payments.count, 1)
    assert.equal(items.count, 1)
    assert.equal(inventory.data.quantity, 2)
  })

  it('enforces cross-shop RLS for products, inventory, sales, payments, and mutation', async () => {
    const productB = await createProduct(ownerB, shopBId, 'private', 2)
    const saleB = await checkout(ownerB, shopBId, [{ id: productB, quantity: '1.000' }])
    assert.ifError(saleB.error)
    const productRead = await ownerA.from('products').select('id').eq('id', productB)
    const inventoryRead = await ownerA
      .from('inventory')
      .select('product_id')
      .eq('product_id', productB)
    const saleRead = await ownerA.from('sales').select('id').eq('id', saleB.data.sale_id)
    const payment = await admin
      .from('payments')
      .select('id')
      .eq('sale_id', saleB.data.sale_id)
      .single()
    const paymentRead = await ownerA.from('payments').select('id').eq('id', payment.data.id)
    const mutation = await ownerA
      .from('products')
      .update({ name: 'compromised' })
      .eq('id', productB)
      .select('id')
    for (const result of [productRead, inventoryRead, saleRead, paymentRead, mutation]) {
      assert.ifError(result.error)
      assert.deepEqual(result.data, [])
    }
  })

  it('persists a signature-verified Stripe transition without a real charge', async () => {
    const productId = await createProduct(ownerA, shopAId, 'stripe', 1)
    const sale = await checkout(
      ownerA,
      shopAId,
      [{ id: productId, quantity: '1.000' }],
      randomUUID(),
      'card'
    )
    assert.ifError(sale.error)
    const payment = await ownerA
      .from('payments')
      .select('*')
      .eq('sale_id', sale.data.sale_id)
      .single()
    const intentId = `pi_test_${randomUUID().replaceAll('-', '')}`
    const attached = await ownerA.rpc('attach_stripe_payment_intent', {
      p_payment_id: payment.data.id,
      p_provider_reference: intentId
    })
    assert.ifError(attached.error)
    const webhookSecret = 'whsec_integration_test'
    const stripe = new Stripe('sk_test_placeholder')
    const payload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      type: 'payment_intent.succeeded',
      data: { object: { id: intentId, amount_received: 1000, currency: 'kes' } }
    })
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret })
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    const transitioned = await admin.rpc('process_stripe_payment_event', {
      p_event_id: event.id,
      p_provider_reference: event.data.object.id,
      p_payment_status: 'completed',
      p_amount_minor: event.data.object.amount_received,
      p_currency: event.data.object.currency
    })
    assert.ifError(transitioned.error)
    const persisted = await admin
      .from('payments')
      .select('status')
      .eq('id', payment.data.id)
      .single()
    assert.equal(persisted.data.status, 'completed')
  })

  it('persists compensating returns and prevents duplicate restoration', async () => {
    const returnProduct = await createProduct(ownerA, shopAId, 'return', 4)
    const returnedSale = await checkout(ownerA, shopAId, [{ id: returnProduct, quantity: '3.000' }])
    assert.ifError(returnedSale.error)
    const saleItem = await admin
      .from('sale_items')
      .select('id,quantity')
      .eq('sale_id', returnedSale.data.sale_id)
      .single()
    const partial = await ownerA.rpc('create_sale_return', {
      p_sale_id: returnedSale.data.sale_id,
      p_items: [{ sale_item_id: saleItem.data.id, quantity: '1.000' }],
      p_reason: 'Integration partial return'
    })
    assert.ifError(partial.error)
    const excessive = await ownerA.rpc('create_sale_return', {
      p_sale_id: returnedSale.data.sale_id,
      p_items: [{ sale_item_id: saleItem.data.id, quantity: '3.000' }],
      p_reason: 'Must fail'
    })
    assert.match(excessive.error?.message ?? '', /exceeds quantity sold/)
    const inventoryAfterReturn = await admin
      .from('inventory')
      .select('quantity')
      .eq('product_id', returnProduct)
      .single()
    const originalItem = await admin
      .from('sale_items')
      .select('quantity')
      .eq('id', saleItem.data.id)
      .single()
    const returnMovement = await admin
      .from('inventory_movements')
      .select('id', { count: 'exact' })
      .eq('reference_id', partial.data.return_id)
      .eq('movement_type', 'RETURN')
    assert.equal(inventoryAfterReturn.data.quantity, 2)
    assert.equal(originalItem.data.quantity, 3)
    assert.equal(returnMovement.count, 1)

    const voidProduct = await createProduct(ownerA, shopAId, 'void', 2)
    const voidedSale = await checkout(ownerA, shopAId, [{ id: voidProduct, quantity: '1.000' }])
    assert.ifError(voidedSale.error)
    const voided = await ownerA.rpc('void_sale', {
      p_sale_id: voidedSale.data.sale_id,
      p_reason: 'Integration void'
    })
    assert.ifError(voided.error)
    const repeated = await ownerA.rpc('void_sale', {
      p_sale_id: voidedSale.data.sale_id,
      p_reason: 'Must not restore twice'
    })
    assert.match(repeated.error?.message ?? '', /already voided/)
    const inventoryAfterVoid = await admin
      .from('inventory')
      .select('quantity')
      .eq('product_id', voidProduct)
      .single()
    const voidMovements = await admin
      .from('inventory_movements')
      .select('id', { count: 'exact' })
      .eq('reference_id', voided.data.return_id)
      .eq('movement_type', 'VOID')
    assert.equal(inventoryAfterVoid.data.quantity, 2)
    assert.equal(voidMovements.count, 1)
  })
})
