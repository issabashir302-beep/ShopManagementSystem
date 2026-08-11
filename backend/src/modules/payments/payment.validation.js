import {
  positiveInteger,
  rejectUnknownFields,
  requireObject,
  uuidField
} from '../../utils/validation.js'
export const validatePaymentId = (value) => uuidField(value, 'paymentId')
export const validatePaymentSaleId = (value) => uuidField(value, 'saleId')
export function validateCreateStripeIntent(body) {
  requireObject(body)
  rejectUnknownFields(body, ['saleId'])
  return { saleId: uuidField(body.saleId, 'saleId') }
}
export function validatePaymentList(query) {
  rejectUnknownFields(query, ['page', 'limit'])
  return {
    page: positiveInteger(query.page, 'page', { defaultValue: 1, max: 1_000_000 }),
    limit: positiveInteger(query.limit, 'limit', { defaultValue: 50, max: 100 })
  }
}
