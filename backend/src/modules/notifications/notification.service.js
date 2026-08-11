import crypto from 'node:crypto'
import { DateTime } from 'luxon'
import { AppError } from '../../errors/AppError.js'
import { monthPeriod, previousMonthPeriod } from '../reports/report.service.js'
import { monthlyReportEmail } from './notification.templates.js'
export class NotificationService {
  constructor({ repository, reportService, emailClient, fromEmail, timezone, logger }) { Object.assign(this, { repository, reportService, emailClient, fromEmail, timezone, logger }) }
  async sendManual(auth, month, requestId) {
    const context = await this.reportService.ownerContext(auth)
    const period = monthPeriod(month, this.timezone)
    return this.deliver(context.shop.id, period, requestId)
  }
  async deliver(shopId, period, requestId = crypto.randomUUID()) {
    const claim = await this.repository.claim(shopId, period.key, requestId)
    if (!claim) { this.logger.info('monthly_report_duplicate_skipped', { requestId, shopId, reportMonth: period.key }); return { sent: false, duplicate: true } }
    try {
      const [target, metrics] = await Promise.all([this.repository.ownerTarget(shopId), this.repository.report(shopId, period.start, period.end)])
      if (!target) throw new AppError(422, 'OWNER_EMAIL_MISSING', 'The shop owner does not have a deliverable email address')
      const report = { shop: { id: shopId, name: target.shop.name, currency: target.shop.currency }, period: { ...period, timezone: this.timezone }, ...metrics }
      const content = monthlyReportEmail(report)
      const result = await this.emailClient.send({ from: this.fromEmail, to: [target.email], ...content }, `monthly-report/${shopId}/${period.key}`)
      if (result.error) throw new Error(result.error.message || 'Resend rejected the email')
      await this.repository.sent(claim.id, result.data?.id)
      this.logger.info('monthly_report_email_sent', { requestId, shopId, reportMonth: period.key, providerMessageId: result.data?.id })
      return { sent: true, duplicate: false, reportMonth: period.key }
    } catch (error) {
      try { await this.repository.failed(claim.id, error.message) } catch (stateError) { this.logger.error('monthly_report_state_update_failed', { requestId, shopId, reportMonth: period.key, error: stateError }) }
      this.logger.error('monthly_report_email_failed', { requestId, shopId, reportMonth: period.key, error })
      throw error
    }
  }
  async runMonthly(now = DateTime.now(), requestId = crypto.randomUUID()) {
    const period = previousMonthPeriod(this.timezone, now)
    const shops = await this.repository.shops()
    const results = []
    for (const shop of shops) {
      try { results.push(await this.deliver(shop.id, period, requestId)) } catch { results.push({ sent: false, failed: true, shopId: shop.id }) }
    }
    return { period: period.key, results }
  }
}
