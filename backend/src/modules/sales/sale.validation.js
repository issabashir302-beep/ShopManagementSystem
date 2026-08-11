import { AppError } from '../../errors/AppError.js'
import { decimalField, positiveInteger, rejectUnknownFields, requireObject, stringField, uuidField } from '../../utils/validation.js'

const METHODS = new Set(['cash', 'mpesa', 'card'])
const STATUSES = new Set(['completed', 'voided', 'refunded'])

export const validateSaleId = (value) => uuidField(value, 'saleId')

export function validateCheckout(body) {
  requireObject(body)
  rejectUnknownFields(body, ['clientRequestId', 'payment', 'items'])
  requireObject(body.payment)
  rejectUnknownFields(body.payment, ['method', 'providerReference', 'externalReference'])
  const method = stringField(body.payment.method, 'payment.method', { required: true }).toLowerCase()
  if (!METHODS.has(method)) throw AppError.badRequest('UNSUPPORTED_PAYMENT_METHOD', 'Payment method must be cash, mpesa, or card')
  if (method === 'card' && (body.payment.providerReference !== undefined || body.payment.externalReference !== undefined)) {
    throw AppError.badRequest('VALIDATION_ERROR', 'Card provider references are assigned by the backend')
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    throw AppError.badRequest('VALIDATION_ERROR', 'items must contain between 1 and 100 entries', { fields: ['items'] })
  }
  const seen = new Set()
  const items = body.items.map((item, index) => {
    requireObject(item)
    rejectUnknownFields(item, ['productId', 'quantity'])
    const productId = uuidField(item.productId, `items[${index}].productId`)
    if (seen.has(productId)) throw AppError.badRequest('DUPLICATE_PRODUCT', 'Duplicate product IDs are not allowed')
    seen.add(productId)
    return { product_id: productId, quantity: decimalField(item.quantity, `items[${index}].quantity`, { scale: 3, min: '0', nonZero: true }) }
  })
  return {
    clientRequestId: uuidField(body.clientRequestId, 'clientRequestId'),
    payment: {
      method,
      providerReference: stringField(body.payment.providerReference, 'payment.providerReference', { max: 200 }),
      externalReference: stringField(body.payment.externalReference, 'payment.externalReference', { max: 200 })
    },
    items
  }
}

export function validateSaleList(query) {
  rejectUnknownFields(query, ['page', 'limit', 'dateFrom', 'dateTo', 'soldBy', 'status'])
  const status = stringField(query.status, 'status')
  if (status && !STATUSES.has(status)) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid sale status')
  const dateFrom = stringField(query.dateFrom, 'dateFrom', { pattern: /^\d{4}-\d{2}-\d{2}$/ })
  const dateTo = stringField(query.dateTo, 'dateTo', { pattern: /^\d{4}-\d{2}-\d{2}$/ })
  if (dateFrom && dateTo && dateFrom > dateTo) throw AppError.badRequest('VALIDATION_ERROR', 'dateFrom must not be after dateTo')
  return {
    page: positiveInteger(query.page, 'page', { defaultValue: 1, max: 1_000_000 }),
    limit: positiveInteger(query.limit, 'limit', { defaultValue: 50, max: 100 }),
    dateFrom, dateTo, soldBy: query.soldBy === undefined ? null : uuidField(query.soldBy, 'soldBy'), status
  }
}
