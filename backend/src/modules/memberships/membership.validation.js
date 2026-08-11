import { AppError } from '../../errors/AppError.js'
import { rejectUnknownFields, requireObject, stringField, uuidField } from '../../utils/validation.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/

export function validateShopkeeperId(value) {
  return uuidField(value, 'shopkeeperId')
}

export function validateShopkeeperCreate(body) {
  requireObject(body)
  rejectUnknownFields(body, ['email', 'password', 'fullName', 'phone', 'username'])
  const email = stringField(body.email, 'email', { required: true, max: 254 })
  if (!EMAIL_PATTERN.test(email)) {
    throw AppError.badRequest('VALIDATION_ERROR', 'email is invalid', { fields: ['email'] })
  }
  if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128 ||
      !/[A-Za-z]/.test(body.password) || !/\d/.test(body.password)) {
    throw AppError.badRequest('VALIDATION_ERROR', 'password must contain 10 to 128 characters, a letter, and a number', {
      fields: ['password']
    })
  }
  return {
    email: email.toLowerCase(),
    password: body.password,
    fullName: stringField(body.fullName, 'fullName', { required: true, min: 2, max: 100 }),
    phone: stringField(body.phone, 'phone', { max: 30, pattern: /^[+0-9() .-]+$/ }),
    username: stringField(body.username, 'username', { min: 3, max: 50, pattern: USERNAME_PATTERN })
  }
}

export function validateShopkeeperUpdate(body) {
  requireObject(body)
  rejectUnknownFields(body, ['fullName', 'phone', 'username'])
  if (Object.keys(body).length === 0) {
    throw AppError.badRequest('VALIDATION_ERROR', 'At least one shopkeeper profile field is required')
  }
  const changes = {}
  if ('fullName' in body) changes.full_name = stringField(body.fullName, 'fullName', { required: true, min: 2, max: 100 })
  if ('phone' in body) changes.phone = stringField(body.phone, 'phone', { max: 30, pattern: /^[+0-9() .-]+$/ })
  if ('username' in body) changes.username = stringField(body.username, 'username', { min: 3, max: 50, pattern: USERNAME_PATTERN })
  return changes
}

export function validateStatusUpdate(body) {
  requireObject(body)
  rejectUnknownFields(body, ['isActive'])
  if (typeof body.isActive !== 'boolean') {
    throw AppError.badRequest('VALIDATION_ERROR', 'isActive must be a boolean', { fields: ['isActive'] })
  }
  return { is_active: body.isActive }
}
