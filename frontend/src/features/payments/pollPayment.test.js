import { describe, expect, it, vi } from 'vitest'
import { pollPaymentStatus } from './pollPayment'
describe('pollPaymentStatus', () => {
  it('returns a webhook-completed payment', async () => { const load = vi.fn().mockResolvedValueOnce({ payments: [{ status: 'pending' }] }).mockResolvedValueOnce({ sale: { id: 'sale-1' }, payments: [{ status: 'completed' }] }); const result = await pollPaymentStatus('sale-1', load, { attempts: 2, wait: () => Promise.resolve() }); expect(result.payment.status).toBe('completed') })
  it('returns null while the backend remains pending', async () => { const load = vi.fn().mockResolvedValue({ payments: [{ status: 'pending' }] }); expect(await pollPaymentStatus('sale-1', load, { attempts: 2, wait: () => Promise.resolve() })).toBeNull() })
})
