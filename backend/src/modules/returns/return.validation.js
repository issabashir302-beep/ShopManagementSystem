import { AppError } from '../../errors/AppError.js'
import {
  decimalField,
  rejectUnknownFields,
  requireObject,
  stringField,
  uuidField
} from '../../utils/validation.js'

export const validateReturnSaleId = (value) => uuidField(value, 'saleId')

export function validateVoid(body) {
  requireObject(body)
  rejectUnknownFields(body, ['reason'])
  return {
    reason: stringField(body.reason, 'reason', { required: true, max: 500 })
  }
}

export function validateReturn(body) {
  requireObject(body)
  rejectUnknownFields(body, ['items', 'reason'])
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    throw AppError.badRequest('VALIDATION_ERROR', 'items must contain between 1 and 100 entries')
  }

  const seen = new Set()
  const items = body.items.map((item, index) => {
    requireObject(item)
    rejectUnknownFields(item, ['saleItemId', 'quantity'])
    const saleItemId = uuidField(item.saleItemId, `items[${index}].saleItemId`)
    if (seen.has(saleItemId)) {
      throw AppError.badRequest('DUPLICATE_SALE_ITEM', 'Duplicate sale item IDs are not allowed')
    }
    seen.add(saleItemId)
    return {
      sale_item_id: saleItemId,
      quantity: decimalField(item.quantity, `items[${index}].quantity`, {
        scale: 3,
        min: '0',
        nonZero: true
      })
    }
  })

  return {
    items,
    reason: stringField(body.reason, 'reason', { required: true, max: 500 })
  }
}
