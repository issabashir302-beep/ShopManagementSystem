import { AppError } from '../../errors/AppError.js'
import { rejectUnknownFields, requireObject, stringField } from '../../utils/validation.js'

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/

export function validateProfileUpdate(body) {
  requireObject(body)
  rejectUnknownFields(body, ['fullName', 'phone', 'username', 'profileCompleted'])

  if (Object.keys(body).length === 0) {
    throw AppError.badRequest('VALIDATION_ERROR', 'At least one profile field is required')
  }

  const result = {}
  if ('fullName' in body) {
    result.full_name = stringField(body.fullName, 'fullName', { required: true, min: 2, max: 100 })
  }
  if ('phone' in body) {
    result.phone = stringField(body.phone, 'phone', { max: 30, pattern: /^[+0-9() .-]+$/ })
  }
  if ('username' in body) {
    result.username = stringField(body.username, 'username', {
      min: 3,
      max: 50,
      pattern: USERNAME_PATTERN
    })
  }
  if ('profileCompleted' in body) {
    if (typeof body.profileCompleted !== 'boolean') {
      throw AppError.badRequest('VALIDATION_ERROR', 'profileCompleted must be a boolean', {
        fields: ['profileCompleted']
      })
    }
    result.profile_completed = body.profileCompleted
  }
  return result
}
