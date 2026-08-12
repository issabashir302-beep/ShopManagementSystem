import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createSaleController } from './sale.controller.js'
import { validateCheckout, validateSaleId, validateSaleList } from './sale.validation.js'

export function createSaleRouter({ authService, saleService }) {
  const router = Router(),
    controller = createSaleController(saleService),
    authenticated = requireAuth(authService)
  const body = (req, _res, next) => {
    try {
      req.validated = validateCheckout(req.body)
      next()
    } catch (error) {
      next(error)
    }
  }
  const query = (req, _res, next) => {
    try {
      req.validatedQuery = validateSaleList(req.query)
      next()
    } catch (error) {
      next(error)
    }
  }
  const id = (req, _res, next) => {
    try {
      req.validatedId = validateSaleId(req.params.saleId)
      next()
    } catch (error) {
      next(error)
    }
  }
  router.post('/checkout', authenticated, body, asyncHandler(controller.checkout))
  router.get('/sales', authenticated, query, asyncHandler(controller.list))
  router.get('/sales/:saleId', authenticated, id, asyncHandler(controller.get))
  return router
}
