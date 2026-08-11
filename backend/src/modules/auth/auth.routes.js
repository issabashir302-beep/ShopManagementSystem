import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { createAuthController } from './auth.controller.js'
import { validateLogin, validateRefresh, validateSignup } from './auth.validation.js'

function validate(validator) {
  return (req, _res, next) => {
    try {
      req.validated = validator(req.body)
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function createAuthRouter(authService) {
  const router = Router()
  const controller = createAuthController(authService)
  const authenticated = requireAuth(authService)

  router.post('/signup', validate(validateSignup), asyncHandler(controller.signup))
  router.post('/login', validate(validateLogin), asyncHandler(controller.login))
  router.post('/refresh', validate(validateRefresh), asyncHandler(controller.refresh))
  router.post('/logout', authenticated, asyncHandler(controller.logout))
  router.get('/session', authenticated, asyncHandler(controller.session))

  return router
}
