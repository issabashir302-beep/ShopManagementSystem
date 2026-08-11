import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createReturnController } from './return.controller.js'
import { validateReturn, validateReturnSaleId, validateVoid } from './return.validation.js'

export function createReturnRouter({ authService, returnService }) {
  const router = Router()
  const controller = createReturnController(returnService)
  const authenticated = requireAuth(authService)

  const validate = (bodyValidator) => (req, _res, next) => {
    try {
      req.validatedId = validateReturnSaleId(req.params.saleId)
      req.validated = bodyValidator(req.body)
      next()
    } catch (error) {
      next(error)
    }
  }

  router.post(
    '/sales/:saleId/void',
    authenticated,
    validate(validateVoid),
    asyncHandler(controller.voidSale)
  )
  router.post(
    '/sales/:saleId/returns',
    authenticated,
    validate(validateReturn),
    asyncHandler(controller.createReturn)
  )
  return router
}
