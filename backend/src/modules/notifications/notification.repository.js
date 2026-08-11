import { AppError } from '../../errors/AppError.js'
function failure() { return new AppError(500, 'NOTIFICATION_QUERY_FAILED', 'Unable to process monthly report delivery') }
export class NotificationRepository {
  constructor(adminClient) { this.adminClient = adminClient }
  async ownerTarget(shopId) {
    const { data, error } = await this.adminClient.from('shops').select('id, name, currency, owner_id, users!shops_owner_id_fkey(email)').eq('id', shopId).is('deleted_at', null).maybeSingle()
    if (error) throw failure()
    const owner = Array.isArray(data?.users) ? data.users[0] : data?.users
    return data && owner?.email ? { shop: data, email: owner.email } : null
  }
  async shops() {
    const { data, error } = await this.adminClient.from('shops').select('id').is('deleted_at', null)
    if (error) throw failure()
    return data ?? []
  }
  async report(shopId, start, end) {
    const { data, error } = await this.adminClient.rpc('get_shop_report', { p_shop_id: shopId, p_start: start, p_end: end })
    if (error) throw failure()
    return data
  }
  async claim(shopId, month, requestId) {
    const { data, error } = await this.adminClient.rpc('claim_report_delivery', { p_shop_id: shopId, p_report_month: `${month}-01`, p_request_id: requestId })
    if (error) throw failure()
    return Array.isArray(data) ? data[0] ?? null : data
  }
  async sent(id, providerMessageId) {
    const { error } = await this.adminClient.from('report_deliveries').update({ status: 'sent', provider_message_id: providerMessageId, sent_at: new Date().toISOString(), last_error: null }).eq('id', id).eq('status', 'processing')
    if (error) throw failure()
  }
  async failed(id, message) {
    const { error } = await this.adminClient.from('report_deliveries').update({ status: 'failed', last_error: String(message).slice(0, 500) }).eq('id', id).eq('status', 'processing')
    if (error) throw failure()
  }
}
