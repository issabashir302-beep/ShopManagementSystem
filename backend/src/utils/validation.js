import { AppError } from '../errors/AppError.js'

export function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw AppError.badRequest('VALIDATION_ERROR', 'Request body must be a JSON object')
  }
}

export function rejectUnknownFields(value, allowedFields) {
  const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field))
  if (unknown.length) {
    throw AppError.badRequest(
      'VALIDATION_ERROR',
      'Request contains unsupported or protected fields',
      {
        fields: unknown
      }
    )
  }
}

export function stringField(value, name, { required = false, min = 0, max, pattern } = {}) {
  if (value === undefined || value === null) {
    if (required)
      throw AppError.badRequest('VALIDATION_ERROR', `${name} is required`, { fields: [name] })
    return undefined
  }
  if (typeof value !== 'string') {
    throw AppError.badRequest('VALIDATION_ERROR', `${name} must be a string`, { fields: [name] })
  }
  const result = value.trim()
  if (required && !result) {
    throw AppError.badRequest('VALIDATION_ERROR', `${name} is required`, { fields: [name] })
  }
  if (
    result.length < min ||
    (max && result.length > max) ||
    (pattern && result && !pattern.test(result))
  ) {
    throw AppError.badRequest('VALIDATION_ERROR', `${name} is invalid`, { fields: [name] })
  }
  return result || null
}

export function uuidField(value, name) {
  return stringField(value, name, {
    required: true,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  })
}

export function decimalField(
  value,
  name,
  { scale, min = '0', allowNegative = false, nonZero = false } = {}
) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw AppError.badRequest('VALIDATION_ERROR', `${name} must be a decimal number`, {
      fields: [name]
    })
  }
  const raw = String(value).trim()
  const pattern = allowNegative
    ? new RegExp(`^-?\\d+(?:\\.\\d{1,${scale}})?$`)
    : new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`)
  if (!pattern.test(raw) || !Number.isFinite(Number(raw))) {
    throw AppError.badRequest('VALIDATION_ERROR', `${name} is invalid`, { fields: [name] })
  }
  const numeric = Number(raw)
  if (numeric < Number(min) || (nonZero && numeric === 0)) {
    throw AppError.badRequest('VALIDATION_ERROR', `${name} is outside the allowed range`, {
      fields: [name]
    })
  }
  return raw
}

export function positiveInteger(value, name, { defaultValue, max }) {
  if (value === undefined) return defaultValue
  const result = Number(value)
  if (!Number.isInteger(result) || result < 1 || result > max) {
    throw AppError.badRequest(
      'VALIDATION_ERROR',
      `${name} must be an integer between 1 and ${max}`,
      {
        fields: [name]
      }
    )
  }
  return result
}
