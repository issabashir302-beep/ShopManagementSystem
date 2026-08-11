import { AppError } from '../../errors/AppError.js'

export function publicSale(row) {
  return {
    id: row.id,
    soldBy: row.sold_by,
    clientRequestId: row.client_request_id,
    receiptNumber: row.receipt_number,
    status: row.status,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by
  }
}
export function publicItem(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    productBarcode: row.product_barcode,
    unit: row.unit,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    unitCost: row.unit_cost,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    subtotal: row.subtotal,
    createdAt: row.created_at
  }
}
export function publicPayment(row) {
  return {
    id: row.id,
    saleId: row.sale_id,
    method: row.method,
    status: row.status,
    amount: row.amount,
    providerReference: row.provider_reference,
    externalReference: row.external_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class SaleService {
  constructor({ saleRepository, shopService, logger }) {
    Object.assign(this, { saleRepository, shopService, logger })
  }
  async context(auth) {
    return this.shopService.getCurrentShopContext(auth)
  }
  async checkout(auth, checkout, requestId) {
    const context = await this.context(auth)
    const result = await this.saleRepository.checkout(context.shop.id, checkout, auth.token)
    const detail = await this.saleRepository.findById(context.shop.id, result.sale_id, auth.token)
    if (!detail)
      throw new AppError(
        500,
        'SALE_READ_FAILED',
        'Checkout completed but the sale could not be read'
      )
    this.logger.info('checkout_completed', {
      requestId,
      shopId: context.shop.id,
      saleId: result.sale_id,
      paymentMethod: checkout.payment.method,
      idempotentReplay: Boolean(result.idempotent_replay)
    })
    return {
      sale: publicSale(detail.sale),
      items: detail.items.map(publicItem),
      payment: publicPayment(detail.payments[0]),
      idempotentReplay: Boolean(result.idempotent_replay)
    }
  }
  async list(auth, filters) {
    const context = await this.context(auth)
    const result = await this.saleRepository.list(context.shop.id, filters, auth.token)
    return {
      items: result.rows.map(publicSale),
      pagination: {
        page: filters.page,
        pageSize: filters.limit,
        total: result.count,
        totalPages: Math.ceil(result.count / filters.limit)
      }
    }
  }
  async get(auth, saleId) {
    const context = await this.context(auth)
    const detail = await this.saleRepository.findById(context.shop.id, saleId, auth.token)
    if (!detail) throw AppError.notFound('SALE_NOT_FOUND', 'Sale was not found')
    return {
      sale: publicSale(detail.sale),
      items: detail.items.map(publicItem),
      payments: detail.payments.map(publicPayment)
    }
  }
}
