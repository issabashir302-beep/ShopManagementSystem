import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DateTime } from 'luxon'
import { NotificationService } from './notification.service.js'
import { monthlyReportEmail } from './notification.templates.js'
import { previousMonthPeriod } from '../reports/report.service.js'
const metrics = {
  totals: {
    transactions: 2,
    totalSales: '20',
    grossRevenue: '20',
    totalDiscounts: '0',
    totalTax: '0',
    grossProfit: '8'
  },
  topProducts: [{ name: '<Rice>', quantitySold: 2 }],
  lowStockProducts: [],
  paymentMethods: [],
  salesByShopkeeper: [],
  inventory: {}
}
function fixture({ fail = false, claim = { id: 'delivery-1' } } = {}) {
  const state = { sends: [], sent: [], failed: [] }
  const repository = {
    async claim() {
      return claim
    },
    async ownerTarget() {
      return { shop: { name: 'Owner Shop', currency: 'KES' }, email: 'trusted@example.com' }
    },
    async report() {
      return metrics
    },
    async sent(...v) {
      state.sent.push(v)
    },
    async failed(...v) {
      state.failed.push(v)
    },
    async shops() {
      return [{ id: 'shop-1' }]
    }
  }
  const service = new NotificationService({
    repository,
    reportService: {
      async ownerContext() {
        return { shop: { id: 'shop-1' } }
      }
    },
    timezone: 'UTC',
    fromEmail: 'reports@example.com',
    logger: { info() {}, error() {} },
    emailClient: {
      async send(message, key) {
        state.sends.push({ message, key })
        if (fail) throw new Error('provider down')
        return { data: { id: 'resend-1' } }
      }
    }
  })
  return { service, state }
}
describe('monthly notifications', () => {
  it('renders safe HTML and plain text', () => {
    const email = monthlyReportEmail({
      shop: { name: 'A', currency: 'KES' },
      period: { label: 'August 2026' },
      ...metrics
    })
    assert.match(email.subject, /August 2026/)
    assert.ok(email.html.includes('&lt;Rice&gt;'))
    assert.match(email.text, /Gross profit/)
  })
  it('always sends to the persisted owner and records provider ID', async () => {
    const f = fixture()
    await f.service.deliver(
      'shop-1',
      previousMonthPeriod('UTC', DateTime.fromISO('2026-09-01T00:00:00Z')),
      'req'
    )
    assert.deepEqual(f.state.sends[0].message.to, ['trusted@example.com'])
    assert.equal(f.state.sent[0][1], 'resend-1')
    assert.match(f.state.sends[0].key, /shop-1\/2026-08/)
  })
  it('records failure without marking sent', async () => {
    const f = fixture({ fail: true })
    await assert.rejects(() =>
      f.service.deliver(
        'shop-1',
        previousMonthPeriod('UTC', DateTime.fromISO('2026-09-01T00:00:00Z'))
      )
    )
    assert.equal(f.state.sent.length, 0)
    assert.equal(f.state.failed.length, 1)
  })
  it('skips a duplicate database claim', async () => {
    const f = fixture({ claim: null })
    assert.deepEqual(await f.service.deliver('shop-1', { key: '2026-08' }), {
      sent: false,
      duplicate: true
    })
    assert.equal(f.state.sends.length, 0)
  })
  it('two executions produce one logical send when the second claim loses', async () => {
    const f = fixture()
    let claimed = false
    f.service.repository.claim = async () =>
      claimed ? null : ((claimed = true), { id: 'delivery-1' })
    const period = previousMonthPeriod('UTC', DateTime.fromISO('2026-09-01T00:00:00Z'))
    await Promise.all([f.service.deliver('shop-1', period), f.service.deliver('shop-1', period)])
    assert.equal(f.state.sends.length, 1)
  })
  it('selects prior month across year boundaries', () => {
    assert.equal(
      previousMonthPeriod('UTC', DateTime.fromISO('2027-01-01T08:00:00Z')).key,
      '2026-12'
    )
    assert.equal(
      previousMonthPeriod('UTC', DateTime.fromISO('2026-09-01T08:00:00Z')).key,
      '2026-08'
    )
  })
})
