import { AppError } from '../../errors/AppError.js'

const SALE_FIELDS =
  'id, shop_id, sold_by, client_request_id, receipt_number, status, subtotal, discount_amount, tax_amount, total_amount, payment_status, created_at, updated_at, voided_at, voided_by'
const ITEM_FIELDS =
  'id, sale_id, product_id, product_name, product_sku, product_barcode, unit, quantity, unit_price, unit_cost, discount_amount, tax_amount, subtotal, created_at'
const PAYMENT_FIELDS =
  'id, sale_id, method, status, amount, provider_reference, external_reference, created_at, updated_at'

function saleError(error) {
  const message = error?.message ?? ''
  if (message.includes('Insufficient stock'))
    return AppError.unprocessable('INSUFFICIENT_STOCK', 'Insufficient stock for checkout')
  if (message.includes('unavailable for this shop'))
    return AppError.notFound('PRODUCT_NOT_FOUND', 'A product was not found or is unavailable')
  if (message.includes('Active shop membership required') || error?.code === '42501')
    return AppError.forbidden()
  if (message.includes('Unsupported payment method'))
    return AppError.badRequest('UNSUPPORTED_PAYMENT_METHOD', 'Unsupported payment method')
  if (error?.code === '23505')
    return AppError.conflict(
      'DUPLICATE_REFERENCE',
      'A payment or checkout reference already exists'
    )
  if (message.includes('positive') || message.includes('must be'))
    return AppError.badRequest('VALIDATION_ERROR', 'Checkout data is invalid')
  return new AppError(500, 'CHECKOUT_FAILED', 'Unable to complete checkout')
}

export class SaleRepository {
  constructor(forAccessToken) {
    this.forAccessToken = forAccessToken
  }

  async checkout(shopId, checkout, token) {
    const { data, error } = await this.forAccessToken(token).rpc('create_sale_with_items', {
      sale_data: {
        shop_id: shopId,
        client_request_id: checkout.clientRequestId,
        payment_method: checkout.payment.method,
        provider_reference: checkout.payment.providerReference,
        external_reference: checkout.payment.externalReference,
        payment_metadata: {}
      },
      items: checkout.items
    })
    if (error) throw saleError(error)
    return data
  }

  async list(shopId, filters, token) {
    const from = (filters.page - 1) * filters.limit
    let query = this.forAccessToken(token)
      .from('sales')
      .select(SALE_FIELDS, { count: 'exact' })
      .eq('shop_id', shopId)
    if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
    if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
    if (filters.soldBy) query = query.eq('sold_by', filters.soldBy)
    if (filters.status) query = query.eq('status', filters.status)
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, from + filters.limit - 1)
    if (error) throw saleError(error)
    return { rows: data ?? [], count: count ?? 0 }
  }

  async findById(shopId, saleId, token) {
    const client = this.forAccessToken(token)
    const saleResult = await client
      .from('sales')
      .select(SALE_FIELDS)
      .eq('shop_id', shopId)
      .eq('id', saleId)
      .maybeSingle()
    if (saleResult.error) throw saleError(saleResult.error)
    if (!saleResult.data) return null
    const [itemsResult, paymentsResult] = await Promise.all([
      client.from('sale_items').select(ITEM_FIELDS).eq('sale_id', saleId).order('created_at'),
      client.from('payments').select(PAYMENT_FIELDS).eq('sale_id', saleId).order('created_at')
    ])
    if (itemsResult.error) throw saleError(itemsResult.error)
    if (paymentsResult.error) throw saleError(paymentsResult.error)
    return {
      sale: saleResult.data,
      items: itemsResult.data ?? [],
      payments: paymentsResult.data ?? []
    }
  }
}
