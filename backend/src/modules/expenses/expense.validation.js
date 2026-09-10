import { AppError } from '../../errors/AppError.js'
import { decimalField, positiveInteger, rejectUnknownFields, requireObject, stringField, uuidField } from '../../utils/validation.js'

export const EXPENSE_CATEGORIES = ['rent', 'utilities', 'transport', 'salaries', 'supplies', 'maintenance', 'marketing', 'taxes', 'other']
export const EXPENSE_METHODS = ['cash', 'mpesa', 'card', 'bank', 'other']
const DATE = /^\d{4}-\d{2}-\d{2}$/

export const validateExpenseId = (value) => uuidField(value, 'expenseId')
const choice = (value, name, values, required = false) => stringField(value, name, { required, pattern: new RegExp(`^(${values.join('|')})$`) })
const date = (value, name, required = false) => {
  const result = stringField(value, name, { required, pattern: DATE })
  if (result && Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw AppError.badRequest('VALIDATION_ERROR', `${name} is invalid`, { fields: [name] })
  return result
}

function fields(body, creation) {
  requireObject(body)
  rejectUnknownFields(body, ['category', 'description', 'amount', 'expenseDate', 'paymentMethod', 'reference', 'notes'])
  if (!creation && !Object.keys(body).length) throw AppError.badRequest('VALIDATION_ERROR', 'At least one expense field is required')
  const result = {}
  if (creation || 'category' in body) result.category = choice(body.category, 'category', EXPENSE_CATEGORIES, true)
  if (creation || 'description' in body) result.description = stringField(body.description, 'description', { required: true, max: 240 })
  if (creation || 'amount' in body) result.amount = decimalField(body.amount, 'amount', { scale: 2, min: '0.01', nonZero: true })
  if (creation || 'expenseDate' in body) result.expense_date = date(body.expenseDate, 'expenseDate', true)
  if (creation || 'paymentMethod' in body) result.payment_method = choice(body.paymentMethod, 'paymentMethod', EXPENSE_METHODS, true)
  if ('reference' in body) result.reference = stringField(body.reference, 'reference', { max: 120 })
  if ('notes' in body) result.notes = stringField(body.notes, 'notes', { max: 1000 })
  return result
}

export const validateExpenseCreate = (body) => fields(body, true)
export const validateExpenseUpdate = (body) => fields(body, false)
export function validateExpenseList(query) {
  rejectUnknownFields(query, ['page', 'pageSize', 'dateFrom', 'dateTo', 'category', 'paymentMethod'])
  const result = {
    page: positiveInteger(query.page, 'page', { defaultValue: 1, max: 1_000_000 }),
    pageSize: positiveInteger(query.pageSize, 'pageSize', { defaultValue: 20, max: 100 }),
    dateFrom: date(query.dateFrom, 'dateFrom'), dateTo: date(query.dateTo, 'dateTo'),
    category: choice(query.category, 'category', EXPENSE_CATEGORIES),
    paymentMethod: choice(query.paymentMethod, 'paymentMethod', EXPENSE_METHODS)
  }
  if (result.dateFrom && result.dateTo && result.dateFrom > result.dateTo) throw AppError.badRequest('VALIDATION_ERROR', 'dateFrom must not be after dateTo')
  return result
}
