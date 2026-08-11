import { AppError } from '../../errors/AppError.js'
import { rejectUnknownFields, requireObject, stringField } from '../../utils/validation.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/

function email(value) {
  const result = stringField(value, 'email', { required: true, max: 254 })
  if (!EMAIL_PATTERN.test(result)) {
    throw AppError.badRequest('VALIDATION_ERROR', 'email is invalid', { fields: ['email'] })
  }
  return result.toLowerCase()
}

function password(value, { enforceStrength }) {
  if (typeof value !== 'string' || value.length > 128 || value.length < 8) {
    throw AppError.badRequest('VALIDATION_ERROR', 'password must contain 8 to 128 characters', {
      fields: ['password']
    })
  }
  if (enforceStrength && (!/[A-Za-z]/.test(value) || !/\d/.test(value))) {
    throw AppError.badRequest(
      'VALIDATION_ERROR',
      'password must contain at least one letter and one number',
      {
        fields: ['password']
      }
    )
  }
  return value
}

export function validateSignup(body) {
  requireObject(body)
  rejectUnknownFields(body, ['email', 'password', 'fullName', 'phone', 'username'])
  return {
    email: email(body.email),
    password: password(body.password, { enforceStrength: true }),
    fullName: stringField(body.fullName, 'fullName', { required: true, min: 2, max: 100 }),
    phone: stringField(body.phone, 'phone', { max: 30, pattern: /^[+0-9() .-]+$/ }),
    username: stringField(body.username, 'username', { min: 3, max: 50, pattern: USERNAME_PATTERN })
  }
}

export function validateLogin(body) {
  requireObject(body)
  rejectUnknownFields(body, ['email', 'password'])
  return {
    email: email(body.email),
    password: password(body.password, { enforceStrength: false })
  }
}

export function validateRefresh(body) {
  requireObject(body)
  rejectUnknownFields(body, ['refreshToken'])
  return {
    refreshToken: stringField(body.refreshToken, 'refreshToken', {
      required: true,
      min: 20,
      max: 4096
    })
  }
}
