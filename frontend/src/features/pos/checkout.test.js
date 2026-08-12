import { describe, expect, it } from 'vitest'
import { checkoutFingerprint, checkoutPayload } from './checkout'
const items = [{ product: { id: 'product-1', sellingPrice: '999.00', shopId: 'never-send' }, quantity: 2 }]
describe('checkout contract', () => {
  it('sends only backend-allowed fields', () => expect(checkoutPayload('request-1', 'cash', items)).toEqual({ clientRequestId: 'request-1', payment: { method: 'cash' }, items: [{ productId: 'product-1', quantity: '2' }] }))
  it('keeps a stable logical fingerprint', () => expect(checkoutFingerprint('cash', items)).toBe(checkoutFingerprint('cash', [...items])))
})
