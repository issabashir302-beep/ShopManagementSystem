import { DateTime } from 'luxon'
import { AppError } from '../../errors/AppError.js'

export function monthPeriod(month, timezone, now = DateTime.now()) {
  const local = month
    ? DateTime.fromFormat(month, 'yyyy-MM', { zone: timezone })
    : now.setZone(timezone)
  if (!local.isValid) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid reporting month')
  const start = local.startOf('month')
  return {
    key: start.toFormat('yyyy-MM'),
    label: start.toFormat('LLLL yyyy'),
    start: start.toUTC().toISO(),
    end: start.plus({ months: 1 }).toUTC().toISO()
  }
}

export function dayPeriod(date, timezone, now = DateTime.now()) {
  const local = date ? DateTime.fromISO(date, { zone: timezone }) : now.setZone(timezone)
  if (!local.isValid) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid reporting date')
  const start = local.startOf('day')
  return {
    key: start.toISODate(),
    label: start.toFormat('dd LLLL yyyy'),
    start: start.toUTC().toISO(),
    end: start.plus({ days: 1 }).toUTC().toISO()
  }
}

export function previousMonthPeriod(timezone, now = DateTime.now()) {
  return monthPeriod(now.setZone(timezone).minus({ months: 1 }).toFormat('yyyy-MM'), timezone, now)
}

export class ReportService {
  constructor({ reportRepository, shopService, timezone, logger }) {
    Object.assign(this, { reportRepository, shopService, timezone, logger })
  }
  async ownerContext(auth) {
    const context = await this.shopService.getCurrentShopContext(auth)
    if (context.membership.role !== 'owner' || context.shop.owner_id !== auth.userId)
      throw AppError.forbidden('Management reports are restricted to the shop owner')
    return context
  }
  async generate(auth, kind, input = {}, requestId) {
    const { shop } = await this.ownerContext(auth)
    const period =
      kind === 'daily'
        ? dayPeriod(input.date, this.timezone)
        : monthPeriod(input.month, this.timezone)
    this.logger.info('report_generation_started', {
      requestId,
      shopId: shop.id,
      reportMonth: period.key
    })
    const metrics = await this.reportRepository.summary(
      shop.id,
      period.start,
      period.end,
      auth.token
    )
    const summary = {
      shop: { id: shop.id, name: shop.name, currency: shop.currency },
      period: {
        key: period.key,
        label: period.label,
        start: period.start,
        endExclusive: period.end,
        timezone: this.timezone
      },
      ...metrics
    }
    this.logger.info('report_generated', { requestId, shopId: shop.id, reportMonth: period.key })
    return this.select(summary, kind)
  }
  select(report, kind) {
    if (kind === 'daily' || kind === 'monthly' || kind === 'summary') return report
    if (kind === 'products')
      return { shop: report.shop, period: report.period, products: report.topProducts }
    if (kind === 'inventory')
      return {
        shop: report.shop,
        inventory: report.inventory,
        lowStockProducts: report.lowStockProducts
      }
    if (kind === 'profit')
      return {
        shop: report.shop,
        period: report.period,
        grossProfit: report.totals.grossProfit,
        grossRevenue: report.totals.grossRevenue
      }
    return report
  }
}
