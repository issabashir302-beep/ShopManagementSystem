import { AppError } from '../../errors/AppError.js'

function reportError(error) {
  if (error?.code === '42501') return AppError.forbidden()
  return new AppError(500, 'REPORT_QUERY_FAILED', 'Unable to generate report')
}

export class ReportRepository {
  constructor(forAccessToken) {
    this.forAccessToken = forAccessToken
  }
  async summary(shopId, start, end, token) {
    const { data, error } = await this.forAccessToken(token).rpc('get_shop_report', {
      p_shop_id: shopId,
      p_start: start,
      p_end: end
    })
    if (error) throw reportError(error)
    return data
  }
}
