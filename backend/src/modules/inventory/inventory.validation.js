import { AppError } from '../../errors/AppError.js'
import {
  decimalField,
  positiveInteger,
  rejectUnknownFields,
  requireObject,
  stringField,
  uuidField
} from '../../utils/validation.js'

const MANUAL_TYPES = new Set(['INITIAL_STOCK', 'RESTOCK', 'ADJUSTMENT', 'DAMAGE'])
const SEARCH_PATTERN = /^[\p{L}\p{N}\s._+/-]+$/u

export const validateInventoryProductId = (value) => uuidField(value, 'productId')

export function validateInventoryList(query) {
  rejectUnknownFields(query, ['search', 'category', 'page', 'pageSize'])
  return {
    search: stringField(query.search, 'search', { max: 100, pattern: SEARCH_PATTERN }),
    category: stringField(query.category, 'category', { max: 100 }),
    page: positiveInteger(query.page, 'page', { defaultValue: 1, max: 1_000_000 }),
    pageSize: positiveInteger(query.pageSize, 'pageSize', { defaultValue: 20, max: 100 })
  }
}

export function validateMovementList(query) {
  rejectUnknownFields(query, ['page', 'pageSize'])
  return {
    page: positiveInteger(query.page, 'page', { defaultValue: 1, max: 1_000_000 }),
    pageSize: positiveInteger(query.pageSize, 'pageSize', { defaultValue: 20, max: 100 })
  }
}

export function validateAdjustment(body) {
  requireObject(body)
  rejectUnknownFields(body, ['movementType', 'quantityChange', 'reason', 'referenceId'])
  const movementType = stringField(body.movementType, 'movementType', {
    required: true
  }).toUpperCase()
  if (!MANUAL_TYPES.has(movementType)) {
    throw AppError.badRequest('INVALID_STOCK_ADJUSTMENT', 'Unsupported manual movement type', {
      fields: ['movementType']
    })
  }
  const quantityChange = decimalField(body.quantityChange, 'quantityChange', {
    scale: 3,
    min: '-99999999999.999',
    allowNegative: true,
    nonZero: true
  })
  const numeric = Number(quantityChange)
  if (['INITIAL_STOCK', 'RESTOCK'].includes(movementType) && numeric <= 0) {
    throw AppError.badRequest(
      'INVALID_STOCK_ADJUSTMENT',
      `${movementType} requires a positive quantityChange`
    )
  }
  if (movementType === 'DAMAGE' && numeric >= 0) {
    throw AppError.badRequest(
      'INVALID_STOCK_ADJUSTMENT',
      'DAMAGE requires a negative quantityChange'
    )
  }
  return {
    movementType,
    quantityChange,
    reason: stringField(body.reason, 'reason', { required: true, min: 3, max: 300 }),
    referenceId: body.referenceId === undefined ? null : uuidField(body.referenceId, 'referenceId')
  }
}
