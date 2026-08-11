import { AppError } from '../../errors/AppError.js'
import {
  decimalField, positiveInteger, rejectUnknownFields, requireObject, stringField, uuidField
} from '../../utils/validation.js'

const PRODUCT_FIELDS = [
  'name', 'sku', 'barcode', 'category', 'unit', 'buyingPrice', 'sellingPrice', 'lowStockThreshold'
]
const SEARCH_PATTERN = /^[\p{L}\p{N}\s._+/-]+$/u

export const validateProductId = (value) => uuidField(value, 'productId')

function productFields(body, creation) {
  requireObject(body)
  rejectUnknownFields(body, PRODUCT_FIELDS)
  if (!creation && Object.keys(body).length === 0) {
    throw AppError.badRequest('VALIDATION_ERROR', 'At least one product field is required')
  }
  const result = {}
  if (creation || 'name' in body) result.name = stringField(body.name, 'name', { required: true, min: 1, max: 160 })
  if ('sku' in body) result.sku = stringField(body.sku, 'sku', { max: 80, pattern: /^[A-Za-z0-9._/-]+$/ })
  if ('barcode' in body) result.barcode = stringField(body.barcode, 'barcode', { max: 100, pattern: /^[A-Za-z0-9._/-]+$/ })
  if ('category' in body) result.category = stringField(body.category, 'category', { max: 100 })
  if (creation || 'unit' in body) result.unit = stringField(body.unit, 'unit', { required: true, min: 1, max: 40 })
  if ('buyingPrice' in body) result.buying_price = decimalField(body.buyingPrice, 'buyingPrice', { scale: 2 })
  if ('sellingPrice' in body) result.selling_price = decimalField(body.sellingPrice, 'sellingPrice', { scale: 2 })
  if ('lowStockThreshold' in body) {
    result.low_stock_threshold = decimalField(body.lowStockThreshold, 'lowStockThreshold', { scale: 3 })
  }
  if (creation) {
    result.buying_price ??= '0'
    result.selling_price ??= '0'
    result.low_stock_threshold ??= '5'
  }
  return result
}

export const validateProductCreate = (body) => productFields(body, true)
export const validateProductUpdate = (body) => productFields(body, false)

export function validateProductList(query) {
  rejectUnknownFields(query, ['search', 'category', 'status', 'page', 'pageSize'])
  const search = stringField(query.search, 'search', { max: 100, pattern: SEARCH_PATTERN })
  return {
    search,
    category: stringField(query.category, 'category', { max: 100 }),
    status: query.status === undefined ? 'active' : stringField(query.status, 'status', {
      required: true, pattern: /^(active|archived|all)$/
    }),
    page: positiveInteger(query.page, 'page', { defaultValue: 1, max: 1_000_000 }),
    pageSize: positiveInteger(query.pageSize, 'pageSize', { defaultValue: 20, max: 100 })
  }
}
