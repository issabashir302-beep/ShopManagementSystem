import { AppError } from '../../errors/AppError.js'
import { rejectUnknownFields, requireObject, stringField } from '../../utils/validation.js'

const SHOP_FIELDS = ['name', 'type', 'location', 'address', 'city', 'country', 'currency']

function currency(value) {
  const result = stringField(value, 'currency', { required: true, min: 3, max: 3 }).toUpperCase()
  if (!/^[A-Z]{3}$/.test(result)) {
    throw AppError.badRequest('VALIDATION_ERROR', 'currency must be a three-letter ISO code', {
      fields: ['currency']
    })
  }
  return result
}

export function validateShopCreate(body) {
  requireObject(body)
  rejectUnknownFields(body, SHOP_FIELDS)
  return {
    name: stringField(body.name, 'name', { required: true, min: 2, max: 120 }),
    type: stringField(body.type, 'type', { max: 80 }),
    location: stringField(body.location, 'location', { max: 200 }),
    address: stringField(body.address, 'address', { max: 300 }),
    city: stringField(body.city, 'city', { max: 100 }),
    country: stringField(body.country, 'country', { max: 100 }),
    currency: body.currency === undefined ? 'KES' : currency(body.currency)
  }
}

export function validateShopUpdate(body) {
  requireObject(body)
  rejectUnknownFields(body, SHOP_FIELDS)
  if (Object.keys(body).length === 0) {
    throw AppError.badRequest('VALIDATION_ERROR', 'At least one shop field is required')
  }

  const result = {}
  if ('name' in body)
    result.name = stringField(body.name, 'name', { required: true, min: 2, max: 120 })
  for (const [input, column, max] of [
    ['type', 'type', 80],
    ['location', 'location', 200],
    ['address', 'address', 300],
    ['city', 'city', 100],
    ['country', 'country', 100]
  ]) {
    if (input in body) result[column] = stringField(body[input], input, { max })
  }
  if ('currency' in body) result.currency = currency(body.currency)
  return result
}
