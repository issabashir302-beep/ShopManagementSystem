import { AppError } from '../errors/AppError.js'

const BEARER_PATTERN = /^Bearer ([^\s]+)$/

export function requireAuth(authService) {
  return async (req, _res, next) => {
    try {
      const authorization = req.get('authorization')
      if (!authorization) throw AppError.unauthorized('Authorization header is required')

      const match = authorization.match(BEARER_PATTERN)
      if (!match) throw AppError.unauthorized('Authorization must use Bearer <token> format')

      const identity = await authService.verifyAccessToken(match[1])
      req.auth = Object.freeze({
        userId: identity.id,
        email: identity.email ?? null,
        token: match[1]
      })
      next()
    } catch (error) {
      next(error)
    }
  }
}
