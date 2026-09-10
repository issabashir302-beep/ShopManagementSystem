import { AppError } from '../../errors/AppError.js'

const fail = (error) => { const result = new AppError(500, 'MPESA_DATA_FAILED', 'Unable to access M-Pesa configuration'); result.cause = error; return result }
export class MpesaRepository {
  constructor({ adminClient, forAccessToken }) { Object.assign(this, { adminClient, forAccessToken }) }
  async getIntegration(shopId) { const { data, error } = await this.adminClient.from('shop_payment_integrations').select('*').eq('shop_id', shopId).eq('provider', 'mpesa_daraja').maybeSingle(); if (error) throw fail(error); return data }
  async saveIntegration(shopId, values) { const clean = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)); const { data, error } = await this.adminClient.from('shop_payment_integrations').upsert({ shop_id: shopId, provider: 'mpesa_daraja', ...clean, updated_at: new Date().toISOString() }, { onConflict: 'shop_id,provider' }).select('*').single(); if (error) throw fail(error); return data }
  async paymentContext(shopId, saleId, token) { const client=this.forAccessToken(token); const { data, error }=await client.from('sales').select('id,shop_id,receipt_number,total_amount,payment_status,payments(id,method,status,amount)').eq('id',saleId).eq('shop_id',shopId).maybeSingle(); if(error) throw fail(error); return data }
  async createAttempt(values) { const { data,error }=await this.adminClient.from('payment_attempts').insert(values).select('*').single(); if(error?.code==='23505') { const found=await this.adminClient.from('payment_attempts').select('*').eq('shop_id',values.shop_id).eq('idempotency_key',values.idempotency_key).single(); if(found.error) throw fail(found.error); return found.data } if(error) throw fail(error); return data }
  async markProcessing(id, response) { const { data,error }=await this.adminClient.from('payment_attempts').update({ status:'processing',merchant_request_id:response.MerchantRequestID,checkout_request_id:response.CheckoutRequestID,updated_at:new Date().toISOString() }).eq('id',id).select('*').single(); if(error) throw fail(error); return data }
  async markInitiationFailed(id, error) { await this.adminClient.from('payment_attempts').update({status:'failed',failure_message:error.message,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id) }
  async getAttempt(shopId,id) { const {data,error}=await this.adminClient.from('payment_attempts').select('*').eq('id',id).eq('shop_id',shopId).maybeSingle(); if(error) throw fail(error); return data }
  async processResult(values) { const {data,error}=await this.adminClient.rpc('process_mpesa_payment_result',values); if(error) throw fail(error); return data }
  async confirmManual(paymentId, receipt, token) { const {data,error}=await this.forAccessToken(token).rpc('confirm_manual_mpesa_payment',{p_payment_id:paymentId,p_receipt_number:receipt}); if(error) throw fail(error); return data }
}
