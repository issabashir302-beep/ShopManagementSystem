import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { createInventoryController } from './inventory.controller.js'
import {
  validateAdjustment, validateInventoryList, validateInventoryProductId, validateMovementList
} from './inventory.validation.js'

function body(validator) {
  return (req, _res, next) => {
    try { req.validated = validator(req.body); next() } catch (error) { next(error) }
  }
}
function id(req, _res, next) {
  try { req.validatedId = validateInventoryProductId(req.params.productId); next() } catch (error) { next(error) }
}
function query(validator) {
  return (req, _res, next) => {
    try { req.validatedQuery = validator(req.query); next() } catch (error) { next(error) }
  }
}

export function createInventoryRouter({ authService, inventoryService }) {
  const router = Router()
  const controller = createInventoryController(inventoryService)
  const authenticated = requireAuth(authService)
  router.get('/inventory', authenticated, query(validateInventoryList), asyncHandler(controller.list))
  router.get('/inventory/low-stock', authenticated, query(validateInventoryList), asyncHandler(controller.lowStock))
  router.get('/products/:productId/inventory', authenticated, id, asyncHandler(controller.get))
  router.get('/products/:productId/inventory/movements', authenticated, id, query(validateMovementList), asyncHandler(controller.movements))
  router.post('/products/:productId/inventory/adjustments', authenticated, id, body(validateAdjustment), asyncHandler(controller.adjust))
  return router
}
