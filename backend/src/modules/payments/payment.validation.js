import {
  positiveInteger,
  rejectUnknownFields,
  requireObject,
  uuidField
} from '../../utils/validation.js'
import { stringField } from '../../utils/validation.js'
export const validatePaymentId = (value) => uuidField(value, 'paymentId')
export const validatePaymentSaleId = (value) => uuidField(value, 'saleId')
export function validateCreateStripeIntent(body) {
  requireObject(body)
  rejectUnknownFields(body, ['saleId'])
  return { saleId: uuidField(body.saleId, 'saleId') }
}
export function validatePaymentList(query) {
  rejectUnknownFields(query, ['page', 'limit', 'pageSize', 'status', 'method', 'dateFrom', 'dateTo'])
  return {
    page: positiveInteger(query.page, 'page', { defaultValue: 1, max: 1_000_000 }),
    limit: positiveInteger(query.limit ?? query.pageSize, 'pageSize', { defaultValue: 50, max: 100 }),
    status: stringField(query.status, 'status', { pattern: /^(pending|completed|failed|refunded)$/ }),
    method: stringField(query.method, 'method', { pattern: /^(cash|mpesa|card)$/ }),
    dateFrom: stringField(query.dateFrom, 'dateFrom', { pattern: /^\d{4}-\d{2}-\d{2}$/ }),
    dateTo: stringField(query.dateTo, 'dateTo', { pattern: /^\d{4}-\d{2}-\d{2}$/ })
  }
}
