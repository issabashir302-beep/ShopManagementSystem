import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createShopController } from './shop.controller.js'
import { validateShopCreate, validateShopUpdate } from './shop.validation.js'

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

export function createShopRouter({ authService, shopService }) {
  const router = Router()
  const controller = createShopController(shopService)
  const authenticated = requireAuth(authService)

  router.post('/', authenticated, validate(validateShopCreate), asyncHandler(controller.create))
  router.get('/me', authenticated, asyncHandler(controller.getMe))
  router.patch('/me', authenticated, validate(validateShopUpdate), asyncHandler(controller.updateMe))

  return router
}
