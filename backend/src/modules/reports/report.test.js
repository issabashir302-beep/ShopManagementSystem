import assert from 'node:assert/strict'
import { afterEach, before, describe, it } from 'node:test'
import { DateTime } from 'luxon'
import { ReportService, dayPeriod, monthPeriod } from './report.service.js'
import { startTestServer } from '../../../tests/helpers/testServer.js'
before(() => { process.env.NODE_ENV = 'test' })
const auth = { userId: 'owner', token: 'token' }
const metrics = { totals: { transactions: 2, totalSales: '190.00', grossRevenue: '200.00', totalDiscounts: '20.00', totalTax: '10.00', grossProfit: '70.00' }, topProducts: [{ name: 'Rice', quantitySold: '3' }], paymentMethods: [{ method: 'cash', amount: '190.00' }], salesByShopkeeper: [], inventory: { products: 2 }, lowStockProducts: [{ name: 'Tea', quantity: '1' }] }
function fixture(role = 'owner') {
  let call
  const service = new ReportService({ timezone: 'Asia/Kuala_Lumpur', logger: { info() {} },
    shopService: { async getCurrentShopContext() { return { shop: { id: 'shop-a', owner_id: 'owner', name: 'A', currency: 'KES' }, membership: { role } } } },
    reportRepository: { async summary(...args) { call = args; return metrics } } })
  return { service, call: () => call }
}
describe('ReportService', () => {
  it('uses the authenticated owner shop and persisted aggregate values', async () => {
    const f = fixture(), result = await f.service.generate(auth, 'summary', { month: '2026-08' }, 'req')
    assert.equal(f.call()[0], 'shop-a'); assert.equal(result.totals.grossProfit, '70.00'); assert.equal(result.paymentMethods[0].method, 'cash'); assert.equal(result.topProducts[0].name, 'Rice'); assert.equal(result.lowStockProducts[0].name, 'Tea')
  })
  it('rejects shopkeepers', async () => assert.rejects(() => fixture('shopkeeper').service.generate(auth, 'summary', {}), { code: 'FORBIDDEN' }))
  it('uses local month boundaries converted to UTC', () => {
    const p = monthPeriod('2026-08', 'Asia/Kuala_Lumpur'); assert.equal(p.start, '2026-07-31T16:00:00.000Z'); assert.equal(p.end, '2026-08-31T16:00:00.000Z')
  })
  it('uses correct DST-aware daily boundaries', () => {
    const p = dayPeriod('2026-03-08', 'America/New_York'); assert.equal(p.start, '2026-03-08T05:00:00.000Z'); assert.equal(p.end, '2026-03-09T04:00:00.000Z')
  })
})
describe('report API security', () => {
  let server
  afterEach(async () => { if (server) await server.close() })
  it('requires auth and passes no browser shop ID', async () => {
    server = await startTestServer(); assert.equal((await server.request('/api/v1/reports/monthly-summary')).response.status, 401)
    assert.equal((await server.request('/api/v1/reports/monthly-summary?shopId=other', { token: 'valid-token' })).response.status, 400)
  })
  it('exposes all owner report routes', async () => {
    server = await startTestServer(); for (const route of ['daily-sales','monthly-sales','products','inventory','profit','monthly-summary']) assert.equal((await server.request(`/api/v1/reports/${route}`, { token: 'valid-token' })).response.status, 200)
  })
})
