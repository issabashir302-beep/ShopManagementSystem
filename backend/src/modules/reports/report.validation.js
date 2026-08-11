import { DateTime } from 'luxon'
import { AppError } from '../../errors/AppError.js'
import { rejectUnknownFields, stringField } from '../../utils/validation.js'

function validDate(value, name) {
  const text = stringField(value, name, { pattern: /^\d{4}-\d{2}-\d{2}$/ })
  if (text && !DateTime.fromISO(text).isValid) throw AppError.badRequest('VALIDATION_ERROR', `${name} must be a valid date`)
  return text
}

export function validateReportPeriod(query) {
  rejectUnknownFields(query, ['date', 'month'])
  const date = validDate(query.date, 'date')
  const month = stringField(query.month, 'month', { pattern: /^\d{4}-\d{2}$/ })
  if (month && !DateTime.fromFormat(month, 'yyyy-MM').isValid) throw AppError.badRequest('VALIDATION_ERROR', 'month must be valid')
  return { date, month }
}

export function validateEmailRequest(body) {
  rejectUnknownFields(body, ['month'])
  const month = stringField(body.month, 'month', { pattern: /^\d{4}-\d{2}$/ })
  if (month && !DateTime.fromFormat(month, 'yyyy-MM').isValid) throw AppError.badRequest('VALIDATION_ERROR', 'month must be valid')
  return { month }
}
