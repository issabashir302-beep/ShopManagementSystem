import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createUserController } from './user.controller.js'
import { validateProfileUpdate } from './user.validation.js'

export function createUserRouter({ authService, userService }) {
  const router = Router()
  const controller = createUserController(userService)
  const authenticated = requireAuth(authService)

  router.get('/me', authenticated, asyncHandler(controller.getMe))
  router.patch(
    '/me',
    authenticated,
    (req, _res, next) => {
      try {
        req.validated = validateProfileUpdate(req.body)
        next()
      } catch (error) {
        next(error)
      }
    },
    asyncHandler(controller.updateMe)
  )

  return router
}
